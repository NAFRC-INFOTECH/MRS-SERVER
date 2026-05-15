import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DoctorReportDocument = DoctorReport & Document;

@Schema({ timestamps: true, collection: 'doctor_reports' })
export class DoctorReport {
  @Prop({ type: Types.ObjectId, ref: 'Patient', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ trim: true, default: '' })
  senderName: string;

  @Prop({ trim: true })
  text?: string;

  @Prop({ trim: true })
  clinicalNote?: string;

  @Prop({ trim: true })
  diagnosis?: string;

  @Prop({ trim: true })
  imageUrl?: string;

  @Prop({ type: Types.ObjectId, ref: 'DoctorReport', required: false })
  replyToId?: Types.ObjectId;
}

export const DoctorReportSchema = SchemaFactory.createForClass(DoctorReport);
