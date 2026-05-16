import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PaymentStatus {
  AWAITING = 'awaiting',
  PAID = 'paid',
  CANCELED = 'canceled',
}

export type InvoiceDocument = Invoice & Document;

class InvoiceDrugItem {
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

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.AWAITING,
  })
  paymentStatus: PaymentStatus;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
