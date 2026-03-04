import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GopdQueue, GopdQueueDocument } from './gopd-queue.schema';
import { PatientDocument } from '../patients/patient.schema';

@Injectable()
export class GopdQueueService {
  constructor(@InjectModel(GopdQueue.name) private readonly model: Model<GopdQueueDocument>) {}

  async ensureFromPatient(p: PatientDocument): Promise<GopdQueueDocument> {
    const pid = new Types.ObjectId(String(p._id));
    const category = p.veteran ? 'personnel' : 'civilian';
    const cardNumber = p.veteran ? (p.serviceNumber || '') : ((p as any).membershipNumber || '');
    const fullName = [p.surname, p.firstname, (p as any).middlename].filter(Boolean).join(' ');
    const phone = p.phone || '';
    const rank = p.rank || '';
    const existing = await this.model.findOne({ patientId: pid });
    if (existing) {
      existing.category = category;
      existing.cardNumber = cardNumber;
      existing.fullName = fullName;
      existing.phone = phone;
      existing.rank = rank;
      return existing.save();
    }
    const doc = new this.model({ patientId: pid, category, cardNumber, fullName, phone, rank });
    return doc.save();
  }

  async list(): Promise<GopdQueueDocument[]> {
    return this.model.find().lean();
  }

  async add(patientId: string): Promise<GopdQueueDocument> {
    const pid = new Types.ObjectId(patientId);
    const doc = new this.model({ patientId: pid });
    return doc.save();
  }

  async remove(patientId: string): Promise<void> {
    await this.model.deleteOne({ patientId: new Types.ObjectId(patientId) });
  }

  async exists(patientId: string): Promise<boolean> {
    const pid = new Types.ObjectId(patientId);
    const f = await this.model.findOne({ patientId: pid }).select({ _id: 1 });
    return !!f;
  }
}
