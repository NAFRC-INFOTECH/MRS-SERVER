import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument, PaymentStatus } from './invoice.schema';
import { Patient, PatientDocument } from '../patients/patient.schema';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>,
  ) {}

  async findAll(): Promise<InvoiceDocument[]> {
    return this.invoiceModel.find().sort({ createdAt: -1 }).lean();
  }

  async create(patientId: string, drugs: any[]): Promise<InvoiceDocument> {
    const id = new Types.ObjectId(patientId);
    const patient = await this.patientModel.findById(id);
    if (!patient) throw new NotFoundException('Patient not found');

    const invoiceDrugs = drugs.map((drug) => ({
      name: drug.name,
      dosage: drug.dosage,
      quantity: drug.quantity,
      instructions: drug.instructions,
      unitPrice: drug.unitPrice || 0,
      totalPrice: (drug.unitPrice || 0) * drug.quantity,
    }));

    const totalCost = invoiceDrugs.reduce((sum, drug) => sum + drug.totalPrice, 0);

    const patientCardNumber = patient.serviceNumber || patient.membershipNumber || String(patient._id);
    const patientName = [patient.surname, patient.firstname, patient.middlename].filter(Boolean).join(' ');

    const invoice = new this.invoiceModel({
      patientId: id,
      patientName,
      patientCardNumber,
      drugs: invoiceDrugs,
      totalCost,
      paymentStatus: PaymentStatus.AWAITING,
    });

    return invoice.save();
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

  async updatePaymentStatus(id: string, status: PaymentStatus): Promise<InvoiceDocument> {
    const doc = await this.invoiceModel.findByIdAndUpdate(id, { paymentStatus: status }, { new: true });
    if (!doc) throw new NotFoundException('Invoice not found');
    return doc;
  }
}
