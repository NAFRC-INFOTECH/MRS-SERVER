import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

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

  @Prop({ type: [String], default: ['patient'] })
  roles: string[];

  @Prop()
  refreshTokenHash?: string;

  @Prop({ default: 0 })
  failedLoginCount: number;

  @Prop()
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
