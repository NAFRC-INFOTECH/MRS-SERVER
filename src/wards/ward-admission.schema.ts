import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WardAdmissionDocument = WardAdmission & Document;

export enum WardAdmissionStatus {
  ADMITTED = 'admitted',
  DISCHARGED = 'discharged',
}

export type WardMedicationOrder = {
  priceItemId: string;
  name: string;
  quantity: number;
  instructions: string;
  usage: string;
};

export type WardMedicationAdministration = {
  drugPriceItemId: string;
  scheduledAt: Date;
  administeredAt: Date;
  administeredByUserId?: Types.ObjectId;
  administeredByRole?: string;
};

@Schema({ timestamps: true, collection: 'ward_admissions' })
export class WardAdmission {
  @Prop({ type: Types.ObjectId, ref: 'Patient', required: true, index: true })
  patientId: Types.ObjectId;

  @Prop({ trim: true, required: true, index: true })
  wardUnit: string;

  @Prop({ trim: true, default: '' })
  bedPriceItemId?: string;

  @Prop({ required: true, min: 1, default: 1 })
  quantity: number;

  @Prop({ type: Date, required: true })
  admittedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  admittedByUserId?: Types.ObjectId;

  @Prop({ trim: true, default: '' })
  admittedByRole?: string;

  @Prop({ type: String, enum: WardAdmissionStatus, default: WardAdmissionStatus.ADMITTED })
  status: WardAdmissionStatus;

  @Prop({ type: Date, required: false })
  dischargedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  dischargedByUserId?: Types.ObjectId;

  @Prop({ trim: true, default: '' })
  dischargedByRole?: string;

  @Prop({ trim: true, default: '' })
  pharmacyPrescription?: string;

  @Prop({
    type: [
      {
        priceItemId: { type: String, trim: true, required: true },
        name: { type: String, trim: true, required: true },
        quantity: { type: Number, required: true, min: 0, default: 0 },
        instructions: { type: String, trim: true, default: '' },
        usage: { type: String, trim: true, default: '' },
      },
    ],
    default: [],
  })
  medicationOrders?: WardMedicationOrder[];

  @Prop({
    type: [
      {
        drugPriceItemId: { type: String, trim: true, required: true },
        scheduledAt: { type: Date, required: true },
        administeredAt: { type: Date, required: true },
        administeredByUserId: { type: Types.ObjectId, ref: 'User', required: false },
        administeredByRole: { type: String, trim: true, default: '' },
      },
    ],
    default: [],
  })
  medicationAdministrations?: WardMedicationAdministration[];
}

export const WardAdmissionSchema = SchemaFactory.createForClass(WardAdmission);
