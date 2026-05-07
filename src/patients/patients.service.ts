import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Patient, PatientDocument } from './patient.schema';
import { GopdQueueService } from '../gopd/gopd-queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class PatientsService {
  constructor(
    @InjectModel(Patient.name) private readonly model: Model<PatientDocument>,
    private readonly gopdQueue: GopdQueueService,
    private readonly rt: RealtimeGateway,
  ) {}

  async list(search?: string): Promise<PatientDocument[]> {
    const q: any = {};
    if (search && search.trim().length > 0) {
      const s = new RegExp(search.trim(), 'i');
      q.$or = [{ surname: s }, { firstname: s }, { lastname: s }, { phone: s }];
    }
    return this.model.find(q).lean();
  }

  async listPaypointReferred(search?: string): Promise<PatientDocument[]> {
    const q: any = {
      $or: [{ patientQueue: 'paypoint' }, { patientStatus: 'paypoint' }],
    };

    if (search && search.trim().length > 0) {
      const s = new RegExp(search.trim(), 'i');
      q.$and = [
        {
          $or: [
            { surname: s },
            { firstname: s },
            { middlename: s },
            { serviceNumber: s },
            { membershipNumber: s },
            { phone: s },
          ],
        },
      ];
    }

    return this.model.find(q).lean();
  }

  async listNHIAReferred(search?: string): Promise<PatientDocument[]> {
    const q: any = {
      $or: [{ patientQueue: 'nhia' }, { patientStatus: 'nhia' }],
    };

    if (search && search.trim().length > 0) {
      const s = new RegExp(search.trim(), 'i');
      q.$and = [
        {
          $or: [
            { surname: s },
            { firstname: s },
            { middlename: s },
            { serviceNumber: s },
            { membershipNumber: s },
            { phone: s },
          ],
        },
      ];
    }

    return this.model.find(q).lean();
  }

  async create(data: Partial<Patient>): Promise<PatientDocument> {
    const doc = new this.model(data);
    const saved = await doc.save();
    this.rt.emit('patient.created', {
      id: String(saved._id),
      patientStatus: saved.patientStatus,
      patientQueue: saved.patientQueue,
    });
    return saved;
  }

  async findById(id: string): Promise<PatientDocument | null> {
    return this.model.findById(id);
  }

  async update(id: string, patch: Partial<Patient>): Promise<PatientDocument> {
    const before = await this.model.findById(id).lean();
    const doc = await this.model.findByIdAndUpdate(id, patch, { new: true });
    if (!doc) throw new NotFoundException('Patient not found');

    const patientId = String(doc._id);
    const inQueue = await this.gopdQueue.exists(patientId);
    if (doc.patientQueue === 'godp_vitals') {
      await this.gopdQueue.ensureFromPatient(doc);
    } else if (inQueue || before?.patientQueue === 'godp_vitals') {
      await this.gopdQueue.remove(patientId);
    }

    this.rt.emit('patient.updated', {
      id: patientId,
      patientStatus: doc.patientStatus,
      patientQueue: doc.patientQueue,
      previousPatientStatus: before?.patientStatus,
      previousPatientQueue: before?.patientQueue,
    });
    return doc;
  }

  async remove(id: string): Promise<void> {
    const res = await this.model.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Patient not found');
    await this.gopdQueue.remove(id);
    this.rt.emit('patient.deleted', {
      id,
      patientStatus: res.patientStatus,
      patientQueue: res.patientQueue,
    });
  }
}
