import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Schema as MSchema } from 'mongoose';
 
export type LabReferralDocument = LabReferral & Document;
 
export enum LabReferralStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  COMPLETED = 'COMPLETED',
}
 
@Schema({ timestamps: true, collection: 'lab_referrals' })
export class LabReferral {
  @Prop({ type: MSchema.Types.ObjectId, ref: 'User', required: true })
  patientId: string;
 
  @Prop({ type: MSchema.Types.ObjectId, ref: 'User', required: true })
  senderId: string;
 
  @Prop({ type: Date, required: true })
  date: Date;
 
  @Prop({ type: String })
  serviceNoOrUUID?: string;
 
  @Prop({ type: String })
  rank?: string;
 
  @Prop({ type: String })
  forenames?: string;
 
  @Prop({ type: String })
  surname?: string;
 
  @Prop({ type: String })
  wardNo?: string;
 
  @Prop({ type: String })
  hospitalUnit?: string;
 
  @Prop({ type: String })
  age?: string;
 
  @Prop({ type: String })
  to?: string;
 
  @Prop({ type: String })
  specimen?: string;
 
  @Prop({ type: String })
  examinationRequired?: string;
 
  @Prop({ type: String })
  diagnosis?: string;
 
  @Prop({ type: String })
  statement?: string;
 
  @Prop({ type: String })
  previousReportNos?: string;
 
  @Prop({ type: Date })
  previousReportDate?: Date;

  @Prop({ type: Map, of: String, default: {} })
  testResults?: Record<string, string>;
 
  @Prop({ type: String, enum: Object.values(LabReferralStatus), default: LabReferralStatus.PENDING })
  status: LabReferralStatus;
}
 
export const LabReferralSchema = SchemaFactory.createForClass(LabReferral);
LabReferralSchema.index({ patientId: 1, date: 1 }, { unique: false });
