import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Patient, PatientDocument } from '../patients/patient.schema';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PriceListService } from '../price-list/price-list.service';
import { WardAdmission, WardAdmissionDocument, WardAdmissionStatus, type WardMedicationOrder } from './ward-admission.schema';

@Injectable()
export class WardsService {
  constructor(
    @InjectModel(WardAdmission.name) private readonly admissions: Model<WardAdmissionDocument>,
    @InjectModel(Patient.name) private readonly patients: Model<PatientDocument>,
    private readonly priceList: PriceListService,
    private readonly rt: RealtimeGateway,
  ) {}

  private readonly WARD_UNITS = ['ChildrenWard', 'FemaleWard', 'MaleWard', 'MaleVIP', 'FemaleVIP'] as const;

  private pickRole(rolesRaw: string[] | undefined, priority: string[]) {
    const roles = (rolesRaw || []).map((r) => {
      const v = String(r || '').trim().toLowerCase();
      return v === 'nurse' ? 'staff' : v;
    });
    return priority.find((r) => roles.includes(r)) || (roles[0] || '');
  }

  private normalizeWardUnit(value: string) {
    const v = String(value || '').trim();
    const match = this.WARD_UNITS.find((x) => x.toLowerCase() === v.toLowerCase());
    if (!match) throw new BadRequestException('Invalid ward unit');
    return match;
  }

  private validatePatientForWard(patient: any, wardUnit: string) {
    const sex = String(patient?.sex || '').trim().toLowerCase();
    const age = Number(patient?.age ?? 0) || 0;
    if (wardUnit === 'ChildrenWard' && age >= 16) {
      throw new BadRequestException('Children ward is only for patients below age 16');
    }
    if (wardUnit === 'MaleWard' || wardUnit === 'MaleVIP') {
      if (sex && sex !== 'male') throw new BadRequestException('Ward requires male patient');
    }
    if (wardUnit === 'FemaleWard' || wardUnit === 'FemaleVIP') {
      if (sex && sex !== 'female') throw new BadRequestException('Ward requires female patient');
    }
  }

  async list(opts?: { wardUnit?: string; status?: WardAdmissionStatus | 'all' }) {
    const q: any = {};
    if (opts?.wardUnit) q.wardUnit = this.normalizeWardUnit(opts.wardUnit);
    if (opts?.status && opts.status !== 'all') q.status = opts.status;
    const docs = await this.admissions.find(q).sort({ admittedAt: -1 }).populate('patientId').lean();
    return (docs as any[]).map((d) => {
      const p = d.patientId || {};
      return {
        _id: String(d._id),
        patientId: String(p._id || d.patientId),
        fullName: [p.surname, p.firstname, p.middlename].filter(Boolean).join(' '),
        cardNumber: p.veteran ? (p.serviceNumber || '') : (p.membershipNumber || ''),
        phone: p.phone || '',
        rank: p.rank || '',
        sex: p.sex || '',
        age: p.age ?? null,
        wardUnit: d.wardUnit,
        bedPriceItemId: d.bedPriceItemId || '',
        quantity: d.quantity || 1,
        admittedAt: d.admittedAt,
        status: d.status,
        dischargedAt: d.dischargedAt || null,
        pharmacyPrescription: d.pharmacyPrescription || '',
        medicationOrders: Array.isArray(d.medicationOrders) ? d.medicationOrders : [],
        medicationAdministrations: Array.isArray(d.medicationAdministrations) ? d.medicationAdministrations : [],
      };
    });
  }

  async admit(
    payload: {
      patientId: string;
      wardUnit: string;
      bedPriceItemId: string;
      quantity?: number;
      pharmacyPrescription?: string;
      medicationOrders?: WardMedicationOrder[];
    },
    meta?: { userId?: string; roles?: string[] }
  ) {
    const pid = new Types.ObjectId(payload.patientId);
    const patient = await this.patients.findById(pid).lean();
    if (!patient) throw new NotFoundException('Patient not found');

    const wardUnit = this.normalizeWardUnit(payload.wardUnit);
    this.validatePatientForWard(patient, wardUnit);

    const quantity = Number(payload.quantity ?? 1);
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive integer');
    }

    const existing = await this.admissions.findOne({ patientId: pid, status: WardAdmissionStatus.ADMITTED }).lean();
    if (existing) throw new BadRequestException('Patient is already admitted');

    const bedPriceItemId = String(payload.bedPriceItemId || '').trim();
    if (!bedPriceItemId) throw new BadRequestException('Bed price item id is required');

    const pharmacyPrescription = String(payload.pharmacyPrescription || '').trim();
    const medicationOrders = (Array.isArray(payload.medicationOrders) ? payload.medicationOrders : [])
      .map((o: any) => ({
        priceItemId: String(o?.priceItemId || '').trim(),
        name: String(o?.name || '').trim(),
        quantity: Number(o?.quantity ?? 0) || 0,
        instructions: String(o?.instructions || '').trim(),
        usage: String(o?.usage || '').trim(),
      }))
      .filter((o) => !!o.priceItemId && !!o.name);

    await this.priceList.occupyBed(bedPriceItemId, quantity);

    const admittedByRole = this.pickRole(meta?.roles, ['pharmacy', 'recording', 'admin', 'super_admin']);
    const doc = new this.admissions({
      patientId: pid,
      wardUnit,
      bedPriceItemId,
      quantity,
      admittedAt: new Date(),
      admittedByUserId: meta?.userId ? new Types.ObjectId(meta.userId) : undefined,
      admittedByRole,
      status: WardAdmissionStatus.ADMITTED,
      pharmacyPrescription,
      medicationOrders,
      medicationAdministrations: [],
    });
    const saved = await doc.save();
    this.rt.emit('wardAdmission.created', { id: String(saved._id), patientId: payload.patientId, wardUnit });
    return saved.toObject();
  }

  async discharge(id: string, meta?: { userId?: string; roles?: string[] }) {
    const doc = await this.admissions.findById(id);
    if (!doc) throw new NotFoundException('Ward admission not found');
    if (doc.status === WardAdmissionStatus.DISCHARGED) return doc.toObject();

    const bedPriceItemId = String(doc.bedPriceItemId || '').trim();
    const qty = Number(doc.quantity || 1);
    if (bedPriceItemId) {
      await this.priceList.releaseBed(bedPriceItemId, qty);
    }

    const dischargedByRole = this.pickRole(meta?.roles, ['ward', 'pharmacy', 'admin', 'super_admin']);
    doc.status = WardAdmissionStatus.DISCHARGED;
    doc.dischargedAt = new Date();
    doc.dischargedByRole = dischargedByRole;
    doc.dischargedByUserId = meta?.userId ? new Types.ObjectId(meta.userId) : undefined;
    const saved = await doc.save();
    this.rt.emit('wardAdmission.updated', { id: String(saved._id), patientId: String(saved.patientId), wardUnit: saved.wardUnit, status: saved.status });
    return saved.toObject();
  }

  async administerMedication(
    admissionId: string,
    payload: { drugPriceItemId: string; scheduledAt: string | Date },
    meta?: { userId?: string; roles?: string[] }
  ) {
    const doc = await this.admissions.findById(admissionId);
    if (!doc) throw new NotFoundException('Ward admission not found');
    if (doc.status !== WardAdmissionStatus.ADMITTED) throw new BadRequestException('Patient is not currently admitted');

    const drugPriceItemId = String(payload.drugPriceItemId || '').trim();
    if (!drugPriceItemId) throw new BadRequestException('drugPriceItemId is required');

    const scheduledAt = new Date(payload.scheduledAt as any);
    if (!Number.isFinite(scheduledAt.getTime())) throw new BadRequestException('Invalid scheduledAt');

    const scheduledAtMs = scheduledAt.getTime();
    const existing = (doc.medicationAdministrations || []).find(
      (x: any) => String(x?.drugPriceItemId || '') === drugPriceItemId && new Date(x?.scheduledAt as any).getTime() === scheduledAtMs
    );
    if (existing) return doc.toObject();

    const administeredByRole = this.pickRole(meta?.roles, ['staff', 'pharmacy', 'admin', 'super_admin']);
    (doc.medicationAdministrations as any) = [
      ...(doc.medicationAdministrations || []),
      {
        drugPriceItemId,
        scheduledAt,
        administeredAt: new Date(),
        administeredByUserId: meta?.userId ? new Types.ObjectId(meta.userId) : undefined,
        administeredByRole,
      },
    ];

    const saved = await doc.save();
    this.rt.emit('wardAdmission.updated', { id: String(saved._id), patientId: String(saved.patientId), wardUnit: saved.wardUnit });
    return saved.toObject();
  }
}
