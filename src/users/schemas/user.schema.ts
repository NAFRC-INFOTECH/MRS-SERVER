import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ _id: false })
class DoctorQualifications {
  @Prop({ default: '' }) medicalDegree: string;
  @Prop({ default: '' }) specialization: string;
  @Prop({ default: '' }) licenses: string;
  @Prop({ default: '' }) boardCertifications: string;
  @Prop({ default: '' }) additionalCertifications: string;
  @Prop({ default: '' }) medicalSchool: string;
  @Prop({ default: '' }) graduationYear: string;
}

@Schema({ _id: false })
class DoctorMeta {
  @Prop({ default: 'pending' }) status: string;
  @Prop({ default: '' }) hospital: string;
  @Prop({ type: DoctorQualifications, default: {} }) qualifications: DoctorQualifications;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  imageUrl?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ trim: true })
  country?: string;

  @Prop({ trim: true })
  state?: string;

  @Prop({ trim: true })
  emergencyPhone?: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ default: 1 })
  passwordVersion: number;

  @Prop({ type: [String], default: [] })
  roles: string[];

  @Prop()
  refreshTokenHash?: string;

  @Prop({ default: 0 })
  failedLoginCount: number;

  @Prop()
  lastLoginAt?: Date;

  @Prop({ default: false })
  suspended: boolean;

  @Prop({ type: DoctorMeta, required: false })
  doctor?: DoctorMeta;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
