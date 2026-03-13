import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DoctorDayList, DoctorDayListDocument } from './daylist.schema';
import { VitalSign, VitalSignDocument } from '../gopd/vitals.schema';

@Injectable()
export class DayListService {
  constructor(
    @InjectModel(DoctorDayList.name) private readonly model: Model<DoctorDayListDocument>,
    @InjectModel(VitalSign.name) private readonly vitalsModel: Model<VitalSignDocument>
  ) {}

  async add(patientId: string, addedBy?: string, sourceDepartment?: string) {
    const pid = new Types.ObjectId(patientId);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const hasVitalsToday = await this.vitalsModel.exists({ patientId: pid, recordedAt: { $gte: start, $lt: end } });
    if (!hasVitalsToday) throw new BadRequestException('Patient has no vitals recorded today');
    const existing = await this.model.findOne({ patientId: pid, createdAt: { $gte: start, $lt: end } }).lean();
    if (existing) return existing;
    const doc = new this.model({ patientId: pid, addedBy: addedBy ? new Types.ObjectId(addedBy) : undefined, sourceDepartment });
    const saved = await doc.save();
    return saved.toObject();
  }

  async list(sourceDepartment?: string, range?: 'today' | 'all', start?: string, end?: string) {
    const q: any = {};
    if (range !== 'all') {
      const now = new Date();
      const s = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const e = end ? new Date(end) : new Date(s);
      if (!end) e.setDate(e.getDate() + 1);
      q.createdAt = { $gte: s, $lt: e };
    }
    if (sourceDepartment) q.sourceDepartment = sourceDepartment;
    const docs = await this.model.find(q).populate('patientId').lean();
    const latestByPatient = new Map<string, any>();
    for (const d of docs as any[]) {
      const pid = String((d as any).patientId?._id || (d as any).patientId || '');
      const prev = latestByPatient.get(pid);
      if (!prev || new Date((d as any).createdAt).getTime() > new Date((prev as any).createdAt).getTime()) {
        latestByPatient.set(pid, d);
      }
    }
    const deduped = Array.from(latestByPatient.values());
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
        createdAt: d.createdAt,
      };
    });
  }
}
