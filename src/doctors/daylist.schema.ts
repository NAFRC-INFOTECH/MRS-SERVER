import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DoctorDayListDocument = DoctorDayList & Document;

@Schema({ timestamps: true, collection: 'doctor_daylist' })
export class DoctorDayList {
  @Prop({ type: Types.ObjectId, ref: 'Patient', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  addedBy?: Types.ObjectId;

  @Prop({ trim: true })
  sourceDepartment?: string;
}

export const DoctorDayListSchema = SchemaFactory.createForClass(DoctorDayList);
