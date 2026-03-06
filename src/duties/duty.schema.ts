import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Types } from 'mongoose';

export type DutyRecordDocument = DutyRecord & Document;

export enum Shift {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  NIGHT = 'NIGHT',
}

export enum DutyStatus {
  ON_DUTY = 'ON_DUTY',
  COMPLETED = 'COMPLETED',
  ABSENT = 'ABSENT',
  SWAPPED = 'SWAPPED',
}

@Schema({ timestamps: { createdAt: true, updatedAt: true }, collection: 'duties' })
export class DutyRecord {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  doctorUserId?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  nurseUserId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: true })
  departmentId: string;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: String, enum: Object.values(Shift), required: true })
  shift: Shift;

  @Prop({ type: Date, required: true })
  timeIn: Date;

  @Prop({ type: Date, required: true })
  timeOut: Date;

  @Prop({ type: String, enum: Object.values(DutyStatus), required: true })
  status: DutyStatus;

  @Prop({ type: String, required: true })
  assignedBy: string;
}

export const DutyRecordSchema = SchemaFactory.createForClass(DutyRecord);
DutyRecordSchema.index({ doctorUserId: 1, date: 1, shift: 1 }, { unique: true, sparse: true });
DutyRecordSchema.index({ nurseUserId: 1, date: 1, shift: 1 }, { unique: true, sparse: true });
DutyRecordSchema.pre('validate', function (next) {
  const self = this as any;
  const hasDoctor = !!self.doctorUserId;
  const hasNurse = !!self.nurseUserId;
  if ((hasDoctor && hasNurse) || (!hasDoctor && !hasNurse)) {
    return next(new Error('Either doctorUserId or nurseUserId must be set, but not both'));
  }
  if (self.timeOut <= self.timeIn) {
    return next(new Error('timeOut must be later than timeIn'));
  }
  next();
});
