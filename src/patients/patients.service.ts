import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Patient, PatientDocument } from './patient.schema';
import { GopdQueueService } from '../gopd/gopd-queue.service';

@Injectable()
export class PatientsService {
  constructor(
    @InjectModel(Patient.name) private readonly model: Model<PatientDocument>,
    private readonly gopdQueue: GopdQueueService
  ) {}

  async list(search?: string): Promise<PatientDocument[]> {
    const q: any = {};
    if (search && search.trim().length > 0) {
      const s = new RegExp(search.trim(), 'i');
      q.$or = [{ surname: s }, { firstname: s }, { lastname: s }, { phone: s }];
    }
    return this.model.find(q).lean();
  }

  async create(data: Partial<Patient>): Promise<PatientDocument> {
    const doc = new this.model(data);
    return doc.save();
  }

  async findById(id: string): Promise<PatientDocument | null> {
    return this.model.findById(id);
  }

  async update(id: string, patch: Partial<Patient>): Promise<PatientDocument> {
    const doc = await this.model.findByIdAndUpdate(id, patch, { new: true });
    if (!doc) throw new NotFoundException('Patient not found');
    const inQueue = await this.gopdQueue.exists(String(doc._id));
    if (doc.patientQueue === 'godp_vitals' || inQueue) {
      await this.gopdQueue.ensureFromPatient(doc);
    }
    return doc;
  }

  async remove(id: string): Promise<void> {
    const res = await this.model.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Patient not found');
  }
}
