import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Patient, PatientDocument } from './patient.schema';
import { PharmacyPatient, PharmacyPatientDocument } from './pharmacy-patient.schema';
import { GopdQueueService } from '../gopd/gopd-queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { InvoicesService } from '../invoices/invoices.service';
import { WardAdmission, WardAdmissionDocument, WardAdmissionStatus } from '../wards/ward-admission.schema';

@Injectable()
export class PatientsService {
  constructor(
    @InjectModel(Patient.name) private readonly model: Model<PatientDocument>,
    @InjectModel(PharmacyPatient.name) private readonly pharmacyModel: Model<PharmacyPatientDocument>,
    @InjectModel(WardAdmission.name) private readonly wardAdmissions: Model<WardAdmissionDocument>,
    private readonly gopdQueue: GopdQueueService,
    private readonly rt: RealtimeGateway,
    private readonly invoices: InvoicesService,
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
      $or: [
        { patientQueue: 'nhia' },
        { patientStatus: 'nhia' },
        { nhiaStatus: { $in: ['cleared', 'not_cleared'] } },
      ],
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

  async getNHIAStats() {
    return this.getNHIAStatsByRange();
  }

  async getNHIAStatsByRange(opts?: { period?: 'daily' | 'monthly' | 'yearly'; value?: string }) {
    const now = new Date();
    const period = opts?.period || 'daily';
    const value = (opts?.value || '').trim();

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

    const awaitingQuery: any = {
      $or: [{ patientQueue: 'nhia' }, { patientStatus: 'nhia' }],
      updatedAt: { $gte: start, $lt: end },
    };

    const clearedQuery: any = { nhiaStatus: 'cleared', nhiaUpdatedAt: { $gte: start, $lt: end } };
    const notClearedQuery: any = { nhiaStatus: 'not_cleared', nhiaUpdatedAt: { $gte: start, $lt: end } };

    const [
      awaiting,
      awaitingCivilian,
      awaitingPersonnel,
      cleared,
      clearedCivilian,
      clearedPersonnel,
      notCleared,
      notClearedCivilian,
      notClearedPersonnel,
    ] = await Promise.all([
      this.model.countDocuments(awaitingQuery),
      this.model.countDocuments({ ...awaitingQuery, veteran: { $ne: true } }),
      this.model.countDocuments({ ...awaitingQuery, veteran: true }),
      this.model.countDocuments(clearedQuery),
      this.model.countDocuments({ ...clearedQuery, veteran: { $ne: true } }),
      this.model.countDocuments({ ...clearedQuery, veteran: true }),
      this.model.countDocuments(notClearedQuery),
      this.model.countDocuments({ ...notClearedQuery, veteran: { $ne: true } }),
      this.model.countDocuments({ ...notClearedQuery, veteran: true }),
    ]);

    return {
      period,
      value: value || (period === 'daily' ? start.toISOString().slice(0, 10) : period === 'monthly' ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}` : String(start.getFullYear())),
      awaiting,
      awaitingCivilian,
      awaitingPersonnel,
      cleared,
      clearedCivilian,
      clearedPersonnel,
      notCleared,
      notClearedCivilian,
      notClearedPersonnel,
    };
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

    const base = await this.pharmacyModel.aggregate(pipeline);
    const patientIds = Array.from(new Set((base as any[]).map((x) => String(x?._id || '')).filter(Boolean)));
    const invoiceByPatientId = new Map<string, any>();
    await Promise.all(
      patientIds.map(async (pid) => {
        const inv = await this.invoices.findLatestByPatientId(pid);
        if (inv) invoiceByPatientId.set(pid, inv);
      })
    );

    const admissions = await this.wardAdmissions
      .find({ patientId: { $in: patientIds.map((id) => new Types.ObjectId(id)) }, status: WardAdmissionStatus.ADMITTED })
      .lean();
    const admissionByPatientId = new Map<string, any>();
    for (const a of admissions as any[]) admissionByPatientId.set(String(a.patientId), a);

    return (base as any[]).map((p) => {
      const pid = String(p?._id || '');
      const inv = invoiceByPatientId.get(pid) || null;
      const admission = admissionByPatientId.get(pid) || null;

      const route = String(inv?.billingRoute || '');
      const paymentStatus = String(inv?.paymentStatus || '');
      const nhiaStampStatus = String(inv?.nhiaStampStatus || '');
      const copayStatus = String(inv?.copayStatus || '');
      const patientAmountDue = Number(inv?.patientAmountDue ?? 0) || 0;

      const cleared =
        !inv
          ? false
          : route === 'paypoint'
            ? paymentStatus === 'paid'
            : nhiaStampStatus === 'stamped' && (patientAmountDue <= 0 || copayStatus === 'paid');

      const hasBed = (() => {
        const drugs = Array.isArray(p?.drugs) ? (p.drugs as any[]) : [];
        return drugs.some((d) => String(d?.dosage || '').toLowerCase() === 'bed fee' || String(d?.category || '').toLowerCase() === 'bed');
      })();

      return {
        ...p,
        pharmacy: {
          deskState: p?.deskState,
          cleared,
          hasInvoice: !!inv,
          invoiceId: inv?._id ? String(inv._id) : '',
          billingRoute: route,
          paymentStatus,
          nhiaStampStatus,
          copayStatus,
          patientAmountDue,
          nhiaAmountDue: Number(inv?.nhiaAmountDue ?? 0) || 0,
          totalCost: Number(inv?.totalCost ?? 0) || 0,
          hasBed,
          admitted: !!admission,
          admittedWardUnit: admission ? String(admission.wardUnit || '') : '',
          admissionId: admission ? String(admission._id || '') : '',
        },
      };
    });
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
    const before = await this.pharmacyModel.findOne({ patientId: id }).lean();
    const update: any = { deskState };
    if (data?.prescription !== undefined) update.prescription = data.prescription;
    if (data?.drugs !== undefined) update.drugs = data.drugs;

    const nextDrugs = Array.isArray(data?.drugs) ? data?.drugs : undefined;
    const beforeDrugs = Array.isArray((before as any)?.drugs) ? (before as any).drugs : [];
    const isDispensingAttempt = (() => {
      if (!nextDrugs) return deskState === 'completed';
      const beforeMap = new Map<string, boolean>();
      for (const d of beforeDrugs) {
        const key = String(d?.priceItemId || d?.name || '');
        beforeMap.set(key, !!d?.dispensed);
      }
      for (const d of nextDrugs) {
        const key = String(d?.priceItemId || d?.name || '');
        const prev = beforeMap.get(key) || false;
        const next = !!d?.dispensed;
        if (!prev && next) return true;
      }
      return deskState === 'completed';
    })();

    if (isDispensingAttempt) {
      const clearance = await this.invoices.isInvoiceClearedForPharmacy(patientId);
      if (!clearance.ok) {
        throw new BadRequestException(String(clearance.reason || 'Invoice not cleared'));
      }
    }

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

  async getNHIAAccess(patientId: string) {
    const doc = await this.model.findById(patientId).lean();
    if (!doc) throw new NotFoundException('Patient not found');

    const statusRaw = String((doc as any).nhiaStatus || '').trim().toLowerCase();
    const inDesk = String((doc as any).patientQueue || '').trim().toLowerCase() === 'nhia' || String((doc as any).patientStatus || '').trim().toLowerCase() === 'nhia';
    const updatedAt = (doc as any).nhiaUpdatedAt || null;

    const status =
      statusRaw === 'cleared'
        ? 'cleared'
        : statusRaw === 'not_cleared'
          ? 'not_cleared'
          : inDesk || statusRaw === 'awaiting'
            ? 'awaiting'
            : 'unknown';

    return {
      patientId: String((doc as any)._id || patientId),
      status,
      hasAccess: status === 'cleared',
      updatedAt
    };
  }
}
