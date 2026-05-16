import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument, PaymentStatus } from './invoice.schema';
import { Patient, PatientDocument } from '../patients/patient.schema';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>,
    private readonly rt: RealtimeGateway,
  ) {}

  async findAll(filters?: { createdByRole?: string; createdByUserId?: string; paymentStatus?: PaymentStatus; paidByRole?: string; paidFrom?: string; paidTo?: string }): Promise<InvoiceDocument[]> {
    const q: any = {};
    if (filters?.createdByRole) q.createdByRole = String(filters.createdByRole).trim();
    if (filters?.createdByUserId) q.createdByUserId = new Types.ObjectId(filters.createdByUserId);
    if (filters?.paymentStatus) q.paymentStatus = filters.paymentStatus;
    if (filters?.paidByRole) q.paidByRole = String(filters.paidByRole).trim();
    if (filters?.paidFrom || filters?.paidTo) {
      const range: any = {};
      if (filters.paidFrom) range.$gte = new Date(filters.paidFrom);
      if (filters.paidTo) range.$lt = new Date(filters.paidTo);
      q.paidAt = range;
    }
    return this.invoiceModel.find(q).sort({ createdAt: -1 }).lean();
  }

  async create(
    patientId: string,
    payload: { drugs?: any[]; items?: any[] },
    meta?: { createdByUserId?: string; roles?: string[] },
  ): Promise<InvoiceDocument> {
    const id = new Types.ObjectId(patientId);
    const patient = await this.patientModel.findById(id);
    if (!patient) throw new NotFoundException('Patient not found');

    const drugs = Array.isArray(payload.drugs) ? payload.drugs : [];
    const items = Array.isArray(payload.items) ? payload.items : [];

    const invoiceDrugs = drugs.map((drug) => ({
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

    const rolePriority = ['recording', 'paypoint', 'pharmacy', 'doctor', 'staff', 'nurse', 'admin', 'super_admin'];
    const roles = (meta?.roles || []).map((r) => (String(r).trim().toLowerCase() === 'nurse' ? 'staff' : r));
    const createdByRole = rolePriority.find((r) => roles.includes(r)) || (roles[0] || '');

    const invoice = new this.invoiceModel({
      patientId: id,
      createdByUserId: meta?.createdByUserId ? new Types.ObjectId(meta.createdByUserId) : undefined,
      createdByRole,
      patientName,
      patientCardNumber,
      drugs: invoiceDrugs,
      items: invoiceItems,
      totalCost,
      paymentStatus: PaymentStatus.AWAITING,
    });

    const saved = await invoice.save();
    this.rt.emit('invoice.created', {
      id: String(saved._id),
      patientId: String(saved.patientId),
      paymentStatus: saved.paymentStatus,
      totalCost: saved.totalCost,
    });
    return saved;
  }

  async findByPatientId(patientId: string): Promise<InvoiceDocument[]> {
    const id = new Types.ObjectId(patientId);
    return this.invoiceModel.find({ patientId: id }).sort({ createdAt: -1 }).lean();
  }

  async findOne(id: string): Promise<InvoiceDocument> {
    const doc = await this.invoiceModel.findById(id);
    if (!doc) throw new NotFoundException('Invoice not found');
    return doc;
  }

  async updatePaymentStatus(id: string, status: PaymentStatus, meta?: { userId?: string; roles?: string[] }): Promise<InvoiceDocument> {
    const update: any = { paymentStatus: status };
    if (status === PaymentStatus.PAID) {
      const rolePriority = ['paypoint', 'recording', 'pharmacy', 'doctor', 'staff', 'nurse', 'admin', 'super_admin'];
      const roles = (meta?.roles || []).map((r) => (String(r).trim().toLowerCase() === 'nurse' ? 'staff' : r));
      const paidByRole = rolePriority.find((r) => roles.includes(r)) || (roles[0] || '');
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
}
