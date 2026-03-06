import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VitalSignDocument = VitalSign & Document;

@Schema({ timestamps: true, collection: 'gopd_vitals' })
export class VitalSign {
  @Prop({ type: Types.ObjectId, ref: 'Patient', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  recordedBy?: Types.ObjectId;

  @Prop({ type: Date, required: true })
  recordedAt: Date;

  @Prop() temperature?: number;
  @Prop() pulse?: number;
  @Prop() respirationRate?: number;
  @Prop() bp?: string;
  @Prop() spo2?: number;
  @Prop() fbsRbs?: string;
  @Prop() height?: number;
  @Prop() weight?: number;
}

export const VitalSignSchema = SchemaFactory.createForClass(VitalSign);
