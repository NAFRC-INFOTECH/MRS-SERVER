import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LabReferral, LabReferralDocument, LabReferralStatus } from './lab-referral.schema';
 
type CreateReferralDto = {
  patientId: string;
  senderId: string;
  date: string;
  serviceNoOrUUID?: string;
  rank?: string;
  forenames?: string;
  surname?: string;
  wardNo?: string;
  hospitalUnit?: string;
  age?: string;
  to?: string;
  specimen?: string;
  examinationRequired?: string;
  diagnosis?: string;
  statement?: string;
  previousReportNos?: string;
  previousReportDate?: string;
};

type LabTestResultsDto = {
  testResults: Record<string, string>;
};
 
@Injectable()
export class LabReferralsService {
  constructor(@InjectModel(LabReferral.name) private readonly model: Model<LabReferralDocument>) {}
 
  async create(dto: CreateReferralDto): Promise<LabReferralDocument> {
    const date = new Date(dto.date || new Date().toISOString());
    const prevDate = dto.previousReportDate ? new Date(dto.previousReportDate) : undefined;
    const doc = new this.model({
      patientId: dto.patientId,
      senderId: dto.senderId,
      date,
      serviceNoOrUUID: dto.serviceNoOrUUID,
      rank: dto.rank,
      forenames: dto.forenames,
      surname: dto.surname,
      wardNo: dto.wardNo,
      hospitalUnit: dto.hospitalUnit,
      age: dto.age,
      to: dto.to,
      specimen: dto.specimen,
      examinationRequired: dto.examinationRequired,
      diagnosis: dto.diagnosis,
      statement: dto.statement,
      previousReportNos: dto.previousReportNos,
      previousReportDate: prevDate,
      testResults: {},
      status: LabReferralStatus.PENDING,
    });
    return await doc.save();
  }
 
  async list(filters: { status?: LabReferralStatus; q?: string; date?: string; patientId?: string; period?: 'daily' | 'monthly' | 'yearly'; value?: string }): Promise<any[]> {
    const q: any = {};
    if (filters.status) q.status = filters.status;
    if (filters.patientId) q.patientId = String(filters.patientId);

    if (filters.date) {
      const d = new Date(filters.date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      q.date = { $gte: d, $lt: next };
    } else if (filters.period || filters.value) {
      const now = new Date();
      const period = filters.period || 'daily';
      const value = (filters.value || '').trim();

      let start: Date;
      let end: Date;
      if (period === 'monthly') {
        const [yRaw, mRaw] = value ? value.split('-') : [];
        const y = Number(yRaw) || now.getFullYear();
        const m = Number(mRaw) || now.getMonth() + 1;
        start = new Date(y, m - 1, 1, 0, 0, 0, 0);
        end = new Date(y, m, 1, 0, 0, 0, 0);
      } else if (period === 'yearly') {
        const y = Number(value) || now.getFullYear();
        start = new Date(y, 0, 1, 0, 0, 0, 0);
        end = new Date(y + 1, 0, 1, 0, 0, 0, 0);
      } else {
        const [yRaw, mRaw, dRaw] = value ? value.split('-') : [];
        const y = Number(yRaw) || now.getFullYear();
        const m = Number(mRaw) || now.getMonth() + 1;
        const d = Number(dRaw) || now.getDate();
        start = new Date(y, m - 1, d, 0, 0, 0, 0);
        end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
      }

      q.date = { $gte: start, $lt: end };
    }
    const list = await this.model
      .find(q)
      .populate('senderId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    return list.map((r: any) => this.mapReferral(r));
  }

  async listForPatient(
    patientId: string,
    filters?: { status?: LabReferralStatus; period?: 'daily' | 'monthly' | 'yearly'; value?: string },
  ): Promise<any[]> {
    const now = new Date();
    const period = filters?.period || 'daily';
    const value = (filters?.value || '').trim();

    let start: Date;
    let end: Date;
    if (period === 'monthly') {
      const [yRaw, mRaw] = value ? value.split('-') : [];
      const y = Number(yRaw) || now.getFullYear();
      const m = Number(mRaw) || now.getMonth() + 1;
      start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      end = new Date(y, m, 1, 0, 0, 0, 0);
    } else if (period === 'yearly') {
      const y = Number(value) || now.getFullYear();
      start = new Date(y, 0, 1, 0, 0, 0, 0);
      end = new Date(y + 1, 0, 1, 0, 0, 0, 0);
    } else {
      const [yRaw, mRaw, dRaw] = value ? value.split('-') : [];
      const y = Number(yRaw) || now.getFullYear();
      const m = Number(mRaw) || now.getMonth() + 1;
      const d = Number(dRaw) || now.getDate();
      start = new Date(y, m - 1, d, 0, 0, 0, 0);
      end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    }

    const q: any = { patientId };
    if (filters?.status) q.status = filters.status;
    q.date = { $gte: start, $lt: end };

    const list = await this.model
      .find(q)
      .populate('senderId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    return list.map((r: any) => this.mapReferral(r));
  }
 
  async setStatus(id: string, status: LabReferralStatus): Promise<any> {
    if (!Object.values(LabReferralStatus).includes(status)) throw new BadRequestException('Invalid status');
    const saved = await this.model.findByIdAndUpdate(id, { status }, { new: true }).lean();
    if (!saved) throw new BadRequestException('Referral not found');
    return { id: String(saved._id), status: saved.status };
  }

  async updateResults(id: string, dto: LabTestResultsDto): Promise<any> {
    const saved = await this.model
      .findByIdAndUpdate(
        id,
        { testResults: dto.testResults || {} },
        { new: true }
      )
      .lean();
    if (!saved) throw new BadRequestException('Referral not found');
    return {
      id: String(saved._id),
      testResults:
        saved.testResults instanceof Map
          ? Object.fromEntries(saved.testResults)
          : (saved.testResults || {}),
    };
  }

  private mapReferral(r: any) {
    const senderObj = typeof r.senderId === 'object' && r.senderId !== null ? r.senderId : null;
    return {
      id: String(r._id),
      patientId: String(r.patientId),
      senderId: String(senderObj?._id || r.senderId),
      senderName: senderObj?.name,
      senderEmail: senderObj?.email,
      date: r.date,
      serviceNoOrUUID: r.serviceNoOrUUID,
      rank: r.rank,
      forenames: r.forenames,
      surname: r.surname,
      wardNo: r.wardNo,
      hospitalUnit: r.hospitalUnit,
      age: r.age,
      to: r.to,
      specimen: r.specimen,
      examinationRequired: r.examinationRequired,
      diagnosis: r.diagnosis,
      statement: r.statement,
      previousReportNos: r.previousReportNos,
      previousReportDate: r.previousReportDate,
      testResults: r.testResults instanceof Map ? Object.fromEntries(r.testResults) : (r.testResults || {}),
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
