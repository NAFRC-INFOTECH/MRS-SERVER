import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { randomBytes } from 'crypto';

export type InvitationDocument = Invitation & Document;

type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

@Schema({ timestamps: true, collection: 'invitations' })
export class Invitation {
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, default: 'doctor' })
  role: string;

  @Prop({ required: true, unique: true, index: true })
  token: string;

  @Prop({ required: true, default: 'pending' })
  status: InvitationStatus;

  @Prop({ trim: true })
  invitedBy?: string;

  @Prop()
  acceptedAt?: Date;
}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);

export function generateInvitationToken() {
  return randomBytes(16).toString('hex');
}
