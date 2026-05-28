import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PaymentStatus {
  AWAITING = 'awaiting',
  PAID = 'paid',
  CANCELED = 'canceled',
}

export enum BillingRoute {
  PAYPOINT = 'paypoint',
  NHIA = 'nhia',
}

export enum NHIAStampStatus {
  AWAITING = 'awaiting',
  STAMPED = 'stamped',
}

export enum CopayStatus {
  AWAITING = 'awaiting',
  PAID = 'paid',
}

export type InvoiceDocument = Invoice & Document;

class InvoiceDrugItem {
  @Prop({ trim: true, default: '' })
  priceItemId?: string;

  @Prop({ trim: true, default: '' })
  category?: string;

  @Prop({ trim: true, default: '' })
  unit?: string;

  @Prop({ trim: true, required: true })
  name: string;

  @Prop({ trim: true, required: true })
  dosage: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ trim: true, default: '' })
  instructions?: string;

  @Prop({ required: true, min: 0 })
  unitPrice: number;

  @Prop({ required: true, min: 0 })
  totalPrice: number;
}

class InvoiceItem {
  @Prop({ trim: true, default: '' })
  priceItemId?: string;

  @Prop({ trim: true, default: '' })
  category?: string;

  @Prop({ trim: true, default: '' })
  unit?: string;

  @Prop({ trim: true, required: true })
  name: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;

  @Prop({ required: true, min: 0 })
  totalPrice: number;
}

@Schema({ timestamps: true, collection: 'invoices' })
export class Invoice {
  @Prop({ type: Types.ObjectId, ref: 'Patient', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  createdByUserId?: Types.ObjectId;

  @Prop({ trim: true, default: '' })
  createdByRole?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  paidByUserId?: Types.ObjectId;

  @Prop({ trim: true, default: '' })
  paidByRole?: string;

  @Prop({ required: false })
  paidAt?: Date;

  @Prop({ trim: true, required: true })
  patientName: string;

  @Prop({ trim: true, required: true })
  patientCardNumber: string;

  @Prop({ type: [Object], default: [] })
  drugs: InvoiceDrugItem[];

  @Prop({ type: [Object], default: [] })
  items: InvoiceItem[];

  @Prop({ required: true, min: 0 })
  totalCost: number;

  @Prop({ type: String, enum: BillingRoute, default: BillingRoute.PAYPOINT })
  billingRoute: BillingRoute;

  @Prop({ default: false })
  patientIsPersonnel?: boolean;

  @Prop({ default: false })
  patientHasNHIAAccess?: boolean;

  @Prop({ required: true, min: 0, default: 0 })
  patientCopayPercent: number;

  @Prop({ required: true, min: 0, default: 0 })
  patientCopayAmount: number;

  @Prop({ required: true, min: 0, default: 0 })
  patientAmountDue: number;

  @Prop({ required: true, min: 0, default: 0 })
  nhiaAmountDue: number;

  @Prop({ type: String, enum: CopayStatus, default: CopayStatus.AWAITING })
  copayStatus: CopayStatus;

  @Prop({ required: false })
  copayPaidAt?: Date;

  @Prop({ trim: true, default: '' })
  copayPaidByRole?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  copayPaidByUserId?: Types.ObjectId;

  @Prop({ type: String, enum: NHIAStampStatus, default: NHIAStampStatus.AWAITING })
  nhiaStampStatus: NHIAStampStatus;

  @Prop({ required: false })
  nhiaStampedAt?: Date;

  @Prop({ trim: true, default: '' })
  nhiaStampedByRole?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  nhiaStampedByUserId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.AWAITING,
  })
  paymentStatus: PaymentStatus;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
