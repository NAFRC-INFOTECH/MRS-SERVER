import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventSequenceDocument = EventSequence & Document;

@Schema({ timestamps: false, collection: 'event_sequences' })
export class EventSequence {
  @Prop({ type: String, required: true, unique: true })
  name: string;

  @Prop({ type: Number, required: true, default: 0 })
  value: number;
}

export const EventSequenceSchema = SchemaFactory.createForClass(EventSequence);

