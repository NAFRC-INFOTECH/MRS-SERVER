import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventRecordDocument = EventRecord & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'event_store' })
export class EventRecord {
  @Prop({ type: Number, required: true, unique: true })
  seq: number;

  @Prop({ type: String, required: true })
  aggregateType: string;

  @Prop({ type: String, required: true })
  aggregateId: string;

  @Prop({ type: String, required: true })
  eventType: string;

  @Prop({ type: Number, required: false })
  version?: number;

  @Prop({ type: Date, required: true })
  occurredAt: Date;

  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;

  @Prop({ type: Object, required: false })
  meta?: Record<string, unknown>;
}

export const EventRecordSchema = SchemaFactory.createForClass(EventRecord);
EventRecordSchema.index({ seq: 1 }, { unique: true });
EventRecordSchema.index({ aggregateType: 1, aggregateId: 1, occurredAt: -1 });
EventRecordSchema.index({ eventType: 1, occurredAt: -1 });
