import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VitalSign, VitalSignDocument } from '../gopd/vitals.schema';
import { ClinicalDayList, ClinicalDayListDocument } from './daylist.schema';

type TargetDepartment = 'EarDoctor' | 'EyeDoctor';

@Injectable()
export class ClinicalDayListService {
  constructor(
    @InjectModel(ClinicalDayList.name) private readonly model: Model<ClinicalDayListDocument>,
    @InjectModel(VitalSign.name) private readonly vitalsModel: Model<VitalSignDocument>
  ) {}

  private normalizeTargetDepartment(v: string): TargetDepartment {
    const raw = String(v || '').trim().toLowerCase();
    if (raw === 'eardoctor' || raw === 'ear') return 'EarDoctor';
    if (raw === 'eyedoctor' || raw === 'eye') return 'EyeDoctor';
    throw new BadRequestException('targetDepartment must be EarDoctor or EyeDoctor');
  }

  async add(patientId: string, targetDepartment: string, addedBy?: string, sourceDepartment?: string) {
    const target = this.normalizeTargetDepartment(targetDepartment);
    const pid = new Types.ObjectId(patientId);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const hasVitalsToday = await this.vitalsModel.exists({ patientId: pid, recordedAt: { $gte: start, $lt: end } });
    if (!hasVitalsToday) throw new BadRequestException('Patient has no vitals recorded today');
    const existing = await this.model
      .findOne({ patientId: pid, targetDepartment: target, createdAt: { $gte: start, $lt: end } })
      .lean();
    if (existing) return existing;
    const doc = new this.model({
      patientId: pid,
      targetDepartment: target,
      addedBy: addedBy ? new Types.ObjectId(addedBy) : undefined,
      sourceDepartment
    });
    const saved = await doc.save();
    return saved.toObject();
  }

  async list(targetDepartment?: string, sourceDepartment?: string, range?: 'today' | 'all', start?: string, end?: string) {
    const q: any = {};
    if (range !== 'all') {
      const now = new Date();
      const s = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const e = end ? new Date(end) : new Date(s);
      if (!end) e.setDate(e.getDate() + 1);
      q.createdAt = { $gte: s, $lt: e };
    }
    if (targetDepartment) q.targetDepartment = this.normalizeTargetDepartment(targetDepartment);
    if (sourceDepartment) q.sourceDepartment = sourceDepartment;
    const docs = await this.model.find(q).populate('patientId').lean();
    const latestByPatientDept = new Map<string, any>();
    for (const d of docs as any[]) {
      const pid = String((d as any).patientId?._id || (d as any).patientId || '');
      const td = String((d as any).targetDepartment || '');
      const key = `${pid}:${td}`;
      const prev = latestByPatientDept.get(key);
      if (!prev || new Date((d as any).createdAt).getTime() > new Date((prev as any).createdAt).getTime()) {
        latestByPatientDept.set(key, d);
      }
    }
    const deduped = Array.from(latestByPatientDept.values());
    return deduped.map((d: any) => {
      const p = d.patientId || {};
      const fullName = [p.surname, p.firstname, p.middlename].filter(Boolean).join(' ');
      const phone = p.phone || '';
      const cardNumber = p.veteran ? (p.serviceNumber || '') : (p.membershipNumber || '');
      const rank = p.rank || '';
      return {
        patientId: String(d.patientId?._id || d.patientId || ''),
        fullName,
        phone,
        cardNumber,
        rank,
        sourceDepartment: d.sourceDepartment || '',
        targetDepartment: d.targetDepartment || '',
        createdAt: d.createdAt
      };
    });
  }
}

