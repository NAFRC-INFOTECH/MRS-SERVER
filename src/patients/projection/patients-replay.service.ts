import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { EventStoreService } from '../../events/event-store.service';
import { Patient, PatientDocument } from '../patient.schema';
import { PharmacyPatient, PharmacyPatientDocument } from '../pharmacy-patient.schema';
import { GopdQueueService } from '../../gopd/gopd-queue.service';

@Injectable()
export class PatientsReplayService {
  constructor(
    private readonly events: EventStoreService,
    @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>,
    @InjectModel(PharmacyPatient.name) private readonly pharmacyModel: Model<PharmacyPatientDocument>,
    private readonly gopdQueue: GopdQueueService
  ) {}

  async rebuildFromEvents() {
    await this.patientModel.deleteMany({});
    await this.pharmacyModel.deleteMany({});
    const existing = await this.gopdQueue.list();
    await Promise.all(existing.map((e) => this.gopdQueue.remove(String((e as any).patientId))));

    const stream = await this.events.scan();
    for (const ev of stream as any[]) {
      if (ev.aggregateType === 'Patient') {
        if (ev.eventType === 'PatientCreated' || ev.eventType === 'PatientUpdated') {
          const patient = (ev.payload || {}).patient;
          if (!patient?._id) continue;
          await this.patientModel.updateOne({ _id: new Types.ObjectId(String(patient._id)) }, { $set: patient }, { upsert: true });
          const pid = String(patient._id);
          if (patient.patientQueue === 'godp_vitals') {
            await this.gopdQueue.ensureFromPatient(patient as any);
          } else {
            await this.gopdQueue.remove(pid);
          }
        } else if (ev.eventType === 'PatientDeleted') {
          const id = String((ev.payload || {}).patientId || ev.aggregateId || '');
          if (!id) continue;
          await this.patientModel.deleteOne({ _id: new Types.ObjectId(id) });
          await this.pharmacyModel.deleteOne({ patientId: new Types.ObjectId(id) });
          await this.gopdQueue.remove(id);
        }
      } else if (ev.aggregateType === 'PharmacyPatient') {
        if (ev.eventType === 'PatientAddedToPharmacy' || ev.eventType === 'PharmacyDeskStateUpdated') {
          const pp = (ev.payload || {}).pharmacyPatient;
          if (!pp?.patientId) continue;
          await this.pharmacyModel.updateOne({ patientId: new Types.ObjectId(String(pp.patientId)) }, { $set: pp }, { upsert: true });
        }
      }
    }
    return { ok: true };
  }
}

