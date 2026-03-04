import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GopdQueueDocument = GopdQueue & Document;

@Schema({ timestamps: true, collection: 'gopd_queue' })
export class GopdQueue {
  @Prop({ type: Types.ObjectId, ref: 'Patient', unique: true })
  patientId: Types.ObjectId;

  @Prop({ trim: true })
  category?: string;

  @Prop({ trim: true })
  cardNumber?: string;

  @Prop({ trim: true })
  fullName?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  rank?: string;
}

export const GopdQueueSchema = SchemaFactory.createForClass(GopdQueue);
