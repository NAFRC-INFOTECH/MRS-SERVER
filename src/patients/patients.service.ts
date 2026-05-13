import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Patient, PatientDocument } from './patient.schema';
import { PharmacyPatient, PharmacyPatientDocument } from './pharmacy-patient.schema';
import { GopdQueueService } from '../gopd/gopd-queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class PatientsService {
  constructor(
    @InjectModel(Patient.name) private readonly model: Model<PatientDocument>,
    @InjectModel(PharmacyPatient.name) private readonly pharmacyModel: Model<PharmacyPatientDocument>,
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

  async listPharmacyReferred(search?: string): Promise<any[]> {
    const pipeline: any[] = [
      {
        $lookup: {
          from: 'patients',
          localField: 'patientId',
          foreignField: '_id',
          as: 'patient',
        },
      },
      { $unwind: '$patient' },
      { $replaceRoot: { newRoot: { $mergeObjects: ['$patient', { deskState: '$deskState', prescription: '$prescription', drugs: '$drugs' }] } } },
    ];

    if (search && search.trim().length > 0) {
      const s = new RegExp(search.trim(), 'i');
      pipeline.push({
        $match: {
          $or: [
            { surname: s },
            { firstname: s },
            { middlename: s },
            { serviceNumber: s },
            { membershipNumber: s },
            { phone: s },
          ],
        },
      });
    }

    return this.pharmacyModel.aggregate(pipeline);
  }

  async addToPharmacy(patientId: string, data?: { prescription?: string; drugs?: any[] }): Promise<PharmacyPatientDocument> {
    const id = new Types.ObjectId(patientId);
    const patient = await this.model.findById(id);
    if (!patient) throw new NotFoundException('Patient not found');
    const update: any = { patientId: id, deskState: 'awaiting-dispense' };
    if (data?.prescription) update.prescription = data.prescription;
    if (data?.drugs) update.drugs = data.drugs;
    return this.pharmacyModel.findOneAndUpdate(
      { patientId: id },
      update,
      { upsert: true, new: true },
    );
  }

  async updatePharmacyDeskState(patientId: string, deskState: string, data?: { prescription?: string; drugs?: any[] }): Promise<PharmacyPatientDocument> {
    const id = new Types.ObjectId(patientId);
    const update: any = { deskState };
    if (data?.prescription !== undefined) update.prescription = data.prescription;
    if (data?.drugs !== undefined) update.drugs = data.drugs;
    const doc = await this.pharmacyModel.findOneAndUpdate(
      { patientId: id },
      update,
      { new: true },
    );
    if (!doc) throw new NotFoundException('Pharmacy patient not found');
    return doc;
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
    await this.pharmacyModel.deleteOne({ patientId: new Types.ObjectId(id) });
    this.rt.emit('patient.deleted', {
      id,
      patientStatus: res.patientStatus,
      patientQueue: res.patientQueue,
    });
  }
}
