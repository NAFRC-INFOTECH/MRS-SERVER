import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PharmacyPatientDocument = PharmacyPatient & Document;

class DrugItem {
  @Prop({ trim: true, required: true })
  name: string;

  @Prop({ trim: true, required: true })
  dosage: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ trim: true, default: '' })
  instructions?: string;
}

@Schema({ timestamps: true, collection: 'pharmacy_patients' })
export class PharmacyPatient {
  @Prop({ type: Types.ObjectId, ref: 'Patient', required: true, unique: true })
  patientId: Types.ObjectId;

  @Prop({ trim: true, default: 'awaiting-dispense' })
  deskState: string;

  @Prop({ trim: true, default: '' })
  prescription?: string;

  @Prop({ type: [Object], default: [] })
  drugs?: DrugItem[];
}

export const PharmacyPatientSchema = SchemaFactory.createForClass(PharmacyPatient);
