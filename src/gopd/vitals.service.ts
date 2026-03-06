import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VitalSign, VitalSignDocument } from './vitals.schema';

@Injectable()
export class VitalsService {
  constructor(@InjectModel(VitalSign.name) private readonly model: Model<VitalSignDocument>) {}

  async create(payload: {
    patientId: string;
    recordedBy?: string;
    recordedAt?: string;
    temperature?: number;
    pulse?: number;
    respirationRate?: number;
    bp?: string;
    spo2?: number;
    fbsRbs?: string;
    height?: number;
    weight?: number;
  }) {
    const patientId = new Types.ObjectId(payload.patientId);
    const recordedBy = payload.recordedBy ? new Types.ObjectId(payload.recordedBy) : undefined;
    const recordedAt = payload.recordedAt ? new Date(payload.recordedAt) : new Date();
    const doc = new this.model({
      patientId,
      recordedBy,
      recordedAt,
      temperature: payload.temperature,
      pulse: payload.pulse,
      respirationRate: payload.respirationRate,
      bp: payload.bp,
      spo2: payload.spo2,
      fbsRbs: payload.fbsRbs,
      height: payload.height,
      weight: payload.weight,
    });
    const saved = await doc.save();
    return this.mapWithYMD(saved.toObject());
  }

  async listForPatient(patientId: string) {
    const pid = new Types.ObjectId(patientId);
    const list = await this.model.find({ patientId: pid }).sort({ recordedAt: -1 }).lean();
    return list.map(this.mapWithYMD);
  }

  private mapWithYMD = (v: any) => {
    const d = new Date(v.recordedAt);
    return {
      ...v,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    };
  };
}
