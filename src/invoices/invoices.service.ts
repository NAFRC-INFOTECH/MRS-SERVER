import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BillingRoute, CopayStatus, Invoice, InvoiceDocument, NHIAStampStatus, PaymentStatus } from './invoice.schema';
import { Patient, PatientDocument } from '../patients/patient.schema';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>,
    private readonly rt: RealtimeGateway,
  ) {}

  async findAll(filters?: {
    createdByRole?: string;
    createdByUserId?: string;
    paymentStatus?: PaymentStatus;
    paidByRole?: string;
    paidFrom?: string;
    paidTo?: string;
    billingRoute?: BillingRoute;
    nhiaStampStatus?: NHIAStampStatus;
    copayStatus?: CopayStatus;
  }): Promise<InvoiceDocument[]> {
    const q: any = {};
    if (filters?.createdByRole) q.createdByRole = String(filters.createdByRole).trim();
    if (filters?.createdByUserId) q.createdByUserId = new Types.ObjectId(filters.createdByUserId);
    if (filters?.paymentStatus) q.paymentStatus = filters.paymentStatus;
    if (filters?.paidByRole) q.paidByRole = String(filters.paidByRole).trim();
    if (filters?.billingRoute) q.billingRoute = filters.billingRoute;
    if (filters?.nhiaStampStatus) q.nhiaStampStatus = filters.nhiaStampStatus;
    if (filters?.copayStatus) q.copayStatus = filters.copayStatus;
    if (filters?.paidFrom || filters?.paidTo) {
      const range: any = {};
      if (filters.paidFrom) range.$gte = new Date(filters.paidFrom);
      if (filters.paidTo) range.$lt = new Date(filters.paidTo);
      q.paidAt = range;
    }
    return this.invoiceModel.find(q).sort({ createdAt: -1 }).lean();
  }

  private pickRole(rolesRaw: string[] | undefined, priority: string[]) {
    const roles = (rolesRaw || []).map((r) => {
      const v = String(r || '').trim().toLowerCase();
      return v === 'nurse' ? 'staff' : v;
    });
    return priority.find((r) => roles.includes(r)) || (roles[0] || '');
  }

  private isNHIAAccess(patient: any) {
    const status = String(patient?.nhiaStatus || '').trim().toLowerCase();
    return status === 'cleared';
  }

  async create(
    patientId: string,
    payload: { drugs?: any[]; items?: any[]; preferredBillingRoute?: BillingRoute },
    meta?: { createdByUserId?: string; roles?: string[] },
  ): Promise<InvoiceDocument> {
    const id = new Types.ObjectId(patientId);
    const patient = await this.patientModel.findById(id);
    if (!patient) throw new NotFoundException('Patient not found');

    const drugs = Array.isArray(payload.drugs) ? payload.drugs : [];
    const items = Array.isArray(payload.items) ? payload.items : [];

    const invoiceDrugs = drugs.map((drug) => ({
      priceItemId: String(drug.priceItemId || '').trim() || undefined,
      category: String(drug.category || '').trim() || undefined,
      unit: String(drug.unit || '').trim() || undefined,
      name: drug.name,
      dosage: drug.dosage,
      quantity: drug.quantity,
      instructions: drug.instructions,
      unitPrice: drug.unitPrice || 0,
      totalPrice: (drug.unitPrice || 0) * drug.quantity,
    }));

    const invoiceItems = items.map((item) => ({
      priceItemId: item.priceItemId,
      category: item.category,
      unit: item.unit,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice || 0,
      totalPrice: (item.unitPrice || 0) * item.quantity,
    }));

    const totalCost =
      invoiceDrugs.reduce((sum, d) => sum + (d.totalPrice || 0), 0) +
      invoiceItems.reduce((sum, d) => sum + (d.totalPrice || 0), 0);

    const patientCardNumber = patient.serviceNumber || patient.membershipNumber || String(patient._id);
    const patientName = [patient.surname, patient.firstname, patient.middlename].filter(Boolean).join(' ');

    const createdByRole = this.pickRole(meta?.roles, [
      'recording',
      'paypoint',
      'pharmacy',
      'doctor',
      'staff',
      'admin',
      'super_admin',
    ]);

    const patientIsPersonnel = !!(patient as any).veteran;
    const patientHasNHIAAccess = this.isNHIAAccess(patient);
    const defaultRoute: BillingRoute = patientIsPersonnel || patientHasNHIAAccess ? BillingRoute.NHIA : BillingRoute.PAYPOINT;
    const preferred = String(payload.preferredBillingRoute || '').trim().toLowerCase();
    const billingRoute: BillingRoute =
      preferred === BillingRoute.PAYPOINT ? BillingRoute.PAYPOINT
        : preferred === BillingRoute.NHIA ? BillingRoute.NHIA
          : defaultRoute;

    const patientCopayPercent = billingRoute === BillingRoute.NHIA ? (patientIsPersonnel ? 0 : 10) : 100;
    const patientCopayAmount = Math.round((totalCost * patientCopayPercent) / 100);
    const patientAmountDue = billingRoute === BillingRoute.NHIA ? patientCopayAmount : totalCost;
    const nhiaAmountDue = billingRoute === BillingRoute.NHIA ? Math.max(0, totalCost - patientCopayAmount) : 0;

    if (billingRoute === BillingRoute.NHIA && !patientIsPersonnel && !patientHasNHIAAccess) {
      throw new BadRequestException('Patient has no NHIA access');
    }

    const invoice = new this.invoiceModel({
      patientId: id,
      createdByUserId: meta?.createdByUserId ? new Types.ObjectId(meta.createdByUserId) : undefined,
      createdByRole,
      patientName,
      patientCardNumber,
      drugs: invoiceDrugs,
      items: invoiceItems,
      totalCost,
      billingRoute,
      patientIsPersonnel,
      patientHasNHIAAccess,
      patientCopayPercent,
      patientCopayAmount,
      patientAmountDue,
      nhiaAmountDue,
      copayStatus: billingRoute === BillingRoute.NHIA && patientAmountDue === 0 ? CopayStatus.PAID : CopayStatus.AWAITING,
      nhiaStampStatus: billingRoute === BillingRoute.NHIA ? NHIAStampStatus.AWAITING : NHIAStampStatus.AWAITING,
      paymentStatus: billingRoute === BillingRoute.PAYPOINT ? PaymentStatus.AWAITING : PaymentStatus.AWAITING,
    });

    const saved = await invoice.save();

    if (billingRoute === BillingRoute.NHIA) {
      await this.patientModel.findByIdAndUpdate(
        id,
        { patientStatus: 'nhia', patientQueue: 'nhia' },
        { new: false },
      );
      this.rt.emit('patient.updated', {
        id: String(id),
        patientStatus: 'nhia',
        patientQueue: 'nhia',
      });
    }

    this.rt.emit('invoice.created', {
      id: String(saved._id),
      patientId: String(saved.patientId),
      paymentStatus: saved.paymentStatus,
      totalCost: saved.totalCost,
      billingRoute: (saved as any).billingRoute,
    });
    return saved;
  }

  async findByPatientId(patientId: string): Promise<InvoiceDocument[]> {
    const id = new Types.ObjectId(patientId);
    return this.invoiceModel.find({ patientId: id }).sort({ createdAt: -1 }).lean();
  }

  async findLatestByPatientId(patientId: string) {
    const id = new Types.ObjectId(patientId);
    return this.invoiceModel.findOne({ patientId: id }).sort({ createdAt: -1 }).lean();
  }

  async findOne(id: string): Promise<InvoiceDocument> {
    const doc = await this.invoiceModel.findById(id);
    if (!doc) throw new NotFoundException('Invoice not found');
    return doc;
  }

  async updatePaymentStatus(id: string, status: PaymentStatus, meta?: { userId?: string; roles?: string[] }): Promise<InvoiceDocument> {
    const before = await this.invoiceModel.findById(id).lean();
    if (!before) throw new NotFoundException('Invoice not found');
    if (String((before as any).billingRoute || '') === BillingRoute.NHIA) {
      throw new BadRequestException('NHIA invoices cannot be paid via paypoint status');
    }

    const update: any = { paymentStatus: status };
    if (status === PaymentStatus.PAID) {
      const paidByRole = this.pickRole(meta?.roles, [
        'paypoint',
        'recording',
        'pharmacy',
        'doctor',
        'staff',
        'admin',
        'super_admin',
      ]);
      update.paidAt = new Date();
      update.paidByRole = paidByRole;
      update.paidByUserId = meta?.userId ? new Types.ObjectId(meta.userId) : undefined;
    } else {
      update.paidAt = undefined;
      update.paidByRole = '';
      update.paidByUserId = undefined;
    }

    const doc = await this.invoiceModel.findByIdAndUpdate(id, update, { new: true });
    if (!doc) throw new NotFoundException('Invoice not found');
    this.rt.emit('invoice.updated', {
      id: String(doc._id),
      patientId: String(doc.patientId),
      paymentStatus: doc.paymentStatus,
      totalCost: doc.totalCost,
      billingRoute: (doc as any).billingRoute,
    });
    if (status === PaymentStatus.PAID) {
      await this.patientModel.findByIdAndUpdate(
        doc.patientId,
        { patientStatus: 'ok', patientQueue: '' },
        { new: false },
      );
      this.rt.emit('patient.updated', {
        id: String(doc.patientId),
        patientStatus: 'ok',
        patientQueue: '',
      });
    }
    return doc;
  }

  async stampNHIA(id: string, meta?: { userId?: string; roles?: string[] }) {
    const before = await this.invoiceModel.findById(id);
    if (!before) throw new NotFoundException('Invoice not found');
    if (String((before as any).billingRoute || '') !== BillingRoute.NHIA) {
      throw new BadRequestException('Invoice is not routed to NHIA');
    }
    const due = Number((before as any).patientAmountDue || 0);
    const copayStatus = String((before as any).copayStatus || '');
    if (due > 0 && copayStatus !== CopayStatus.PAID) {
      throw new BadRequestException('Awaiting 10% payment confirmation from paypoint');
    }
    const role = this.pickRole(meta?.roles, ['staff', 'admin', 'super_admin']);
    before.nhiaStampStatus = NHIAStampStatus.STAMPED;
    before.nhiaStampedAt = new Date();
    before.nhiaStampedByRole = role;
    before.nhiaStampedByUserId = meta?.userId ? new Types.ObjectId(meta.userId) : undefined;
    const saved = await before.save();
    this.rt.emit('invoice.updated', {
      id: String(saved._id),
      patientId: String(saved.patientId),
      paymentStatus: saved.paymentStatus,
      totalCost: saved.totalCost,
      billingRoute: (saved as any).billingRoute,
    });
    return saved;
  }

  async markCopayPaid(id: string, meta?: { userId?: string; roles?: string[] }) {
    const before = await this.invoiceModel.findById(id);
    if (!before) throw new NotFoundException('Invoice not found');
    if (String((before as any).billingRoute || '') !== BillingRoute.NHIA) {
      throw new BadRequestException('Invoice is not routed to NHIA');
    }
    if (Number((before as any).patientAmountDue || 0) <= 0) {
      before.copayStatus = CopayStatus.PAID;
      const saved0 = await before.save();
      this.rt.emit('invoice.updated', {
        id: String(saved0._id),
        patientId: String(saved0.patientId),
        paymentStatus: saved0.paymentStatus,
        totalCost: saved0.totalCost,
        billingRoute: (saved0 as any).billingRoute,
      });
      return saved0;
    }
    const role = this.pickRole(meta?.roles, ['staff', 'paypoint', 'admin', 'super_admin']);
    before.copayStatus = CopayStatus.PAID;
    before.copayPaidAt = new Date();
    before.copayPaidByRole = role;
    before.copayPaidByUserId = meta?.userId ? new Types.ObjectId(meta.userId) : undefined;
    const saved = await before.save();
    this.rt.emit('invoice.updated', {
      id: String(saved._id),
      patientId: String(saved.patientId),
      paymentStatus: saved.paymentStatus,
      totalCost: saved.totalCost,
      billingRoute: (saved as any).billingRoute,
    });
    return saved;
  }

  async updateItems(id: string, items: any[], meta?: { userId?: string; roles?: string[] }) {
    const doc = await this.invoiceModel.findById(id);
    if (!doc) throw new NotFoundException('Invoice not found');
    if (doc.paymentStatus === PaymentStatus.CANCELED) {
      throw new BadRequestException('Invoice is canceled');
    }

    const route = String((doc as any).billingRoute || '');
    if (route === BillingRoute.PAYPOINT && doc.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Paid invoices cannot be modified');
    }
    if (route === BillingRoute.NHIA && String((doc as any).nhiaStampStatus || '') === NHIAStampStatus.STAMPED) {
      throw new BadRequestException('Stamped NHIA invoices cannot be modified');
    }

    const safeItems = Array.isArray(items) ? items : [];
    const invoiceItems = safeItems.map((item) => ({
      priceItemId: item.priceItemId,
      category: item.category,
      unit: item.unit,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice || 0,
      totalPrice: (item.unitPrice || 0) * item.quantity,
    }));

    const invoiceDrugs = Array.isArray((doc as any).drugs) ? (doc as any).drugs : [];
    const drugsTotal = invoiceDrugs.reduce((sum: number, d: any) => sum + (Number(d.totalPrice || 0) || 0), 0);
    const itemsTotal = invoiceItems.reduce((sum, d) => sum + (Number(d.totalPrice || 0) || 0), 0);
    const totalCost = drugsTotal + itemsTotal;

    const patientIsPersonnel = !!(doc as any).patientIsPersonnel;
    const patientHasNHIAAccess = !!(doc as any).patientHasNHIAAccess;

    if (route === BillingRoute.NHIA && !patientIsPersonnel && !patientHasNHIAAccess) {
      throw new BadRequestException('Patient has no NHIA access');
    }

    const patientCopayPercent = route === BillingRoute.NHIA ? (patientIsPersonnel ? 0 : 10) : 100;
    const patientCopayAmount = Math.round((totalCost * patientCopayPercent) / 100);
    const patientAmountDue = route === BillingRoute.NHIA ? patientCopayAmount : totalCost;
    const nhiaAmountDue = route === BillingRoute.NHIA ? Math.max(0, totalCost - patientCopayAmount) : 0;

    doc.items = invoiceItems as any;
    doc.totalCost = totalCost;
    (doc as any).patientCopayPercent = patientCopayPercent;
    (doc as any).patientCopayAmount = patientCopayAmount;
    (doc as any).patientAmountDue = patientAmountDue;
    (doc as any).nhiaAmountDue = nhiaAmountDue;

    if (route === BillingRoute.NHIA) {
      if (patientAmountDue <= 0) {
        (doc as any).copayStatus = CopayStatus.PAID;
        (doc as any).copayPaidAt = undefined;
        (doc as any).copayPaidByRole = '';
        (doc as any).copayPaidByUserId = undefined;
      } else {
        (doc as any).copayStatus = CopayStatus.AWAITING;
        (doc as any).copayPaidAt = undefined;
        (doc as any).copayPaidByRole = '';
        (doc as any).copayPaidByUserId = undefined;
      }
    }

    const saved = await doc.save();
    this.rt.emit('invoice.updated', {
      id: String(saved._id),
      patientId: String(saved.patientId),
      paymentStatus: saved.paymentStatus,
      totalCost: saved.totalCost,
      billingRoute: (saved as any).billingRoute,
    });
    return saved;
  }

  async cancelInvoice(id: string, meta?: { userId?: string; roles?: string[] }) {
    const doc = await this.invoiceModel.findById(id);
    if (!doc) throw new NotFoundException('Invoice not found');
    if (doc.paymentStatus === PaymentStatus.CANCELED) return doc;

    const route = String((doc as any).billingRoute || '');
    if (route === BillingRoute.PAYPOINT && doc.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Paid invoices cannot be canceled');
    }
    if (route === BillingRoute.NHIA && String((doc as any).nhiaStampStatus || '') === NHIAStampStatus.STAMPED) {
      throw new BadRequestException('Stamped NHIA invoices cannot be canceled');
    }

    doc.paymentStatus = PaymentStatus.CANCELED;
    (doc as any).paidAt = undefined;
    (doc as any).paidByRole = '';
    (doc as any).paidByUserId = undefined;

    doc.items = [] as any;
    doc.drugs = [] as any;
    doc.totalCost = 0;
    (doc as any).patientCopayPercent = 0;
    (doc as any).patientCopayAmount = 0;
    (doc as any).patientAmountDue = 0;
    (doc as any).nhiaAmountDue = 0;
    (doc as any).copayStatus = CopayStatus.PAID;
    (doc as any).copayPaidAt = undefined;
    (doc as any).copayPaidByRole = '';
    (doc as any).copayPaidByUserId = undefined;
    (doc as any).nhiaStampStatus = NHIAStampStatus.AWAITING;
    (doc as any).nhiaStampedAt = undefined;
    (doc as any).nhiaStampedByRole = '';
    (doc as any).nhiaStampedByUserId = undefined;

    const saved = await doc.save();
    this.rt.emit('invoice.updated', {
      id: String(saved._id),
      patientId: String(saved.patientId),
      paymentStatus: saved.paymentStatus,
      totalCost: saved.totalCost,
      billingRoute: (saved as any).billingRoute,
    });

    await this.patientModel.findByIdAndUpdate(
      saved.patientId,
      { patientStatus: 'ok', patientQueue: '' },
      { new: false },
    );
    this.rt.emit('patient.updated', {
      id: String(saved.patientId),
      patientStatus: 'ok',
      patientQueue: '',
    });

    return saved;
  }

  async isInvoiceClearedForPharmacy(patientId: string) {
    const pid = new Types.ObjectId(patientId);
    const inv = await this.invoiceModel.findOne({ patientId: pid }).sort({ createdAt: -1 }).lean();
    if (!inv) return { ok: false, reason: 'No invoice found' };
    if (String((inv as any).paymentStatus || '') === PaymentStatus.CANCELED) {
      return { ok: false, reason: 'Invoice canceled', invoice: inv };
    }

    const route = String((inv as any).billingRoute || '');
    if (route === BillingRoute.PAYPOINT) {
      if ((inv as any).paymentStatus === PaymentStatus.PAID) return { ok: true, invoice: inv };
      return { ok: false, reason: 'Awaiting payment at paypoint', invoice: inv };
    }

    const stamped = String((inv as any).nhiaStampStatus || '') === NHIAStampStatus.STAMPED;
    if (!stamped) return { ok: false, reason: 'Awaiting NHIA stamp', invoice: inv };

    const due = Number((inv as any).patientAmountDue || 0);
    if (due > 0 && String((inv as any).copayStatus || '') !== CopayStatus.PAID) {
      return { ok: false, reason: 'Awaiting NHIA copay payment', invoice: inv };
    }
    return { ok: true, invoice: inv };
  }
}
