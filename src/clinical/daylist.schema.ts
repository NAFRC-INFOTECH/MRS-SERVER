import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClinicalDayListDocument = ClinicalDayList & Document;

@Schema({ timestamps: true, collection: 'clinical_daylist' })
export class ClinicalDayList {
  @Prop({ type: Types.ObjectId, ref: 'Patient', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  addedBy?: Types.ObjectId;

  @Prop({ trim: true })
  sourceDepartment?: string;

  @Prop({ trim: true, required: true })
  targetDepartment: string;
}

export const ClinicalDayListSchema = SchemaFactory.createForClass(ClinicalDayList);
ClinicalDayListSchema.index({ patientId: 1, targetDepartment: 1, createdAt: -1 });

