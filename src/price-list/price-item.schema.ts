import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PriceItemDocument = PriceItem & Document;

export enum PriceCategory {
  DRUG = 'drug',
  CONSULTATION = 'consultation',
  BED = 'bed',
  PROCEDURE = 'procedure',
  LABORATORY = 'laboratory',
  OTHER = 'other',
}

@Schema({ timestamps: true, collection: 'price_list_items' })
export class PriceItem {
  @Prop({ trim: true, required: true })
  name: string;

  @Prop({ type: String, required: true, trim: true })
  category: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ trim: true, default: 'per item' })
  unit: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sortOrder: number;
}

export const PriceItemSchema = SchemaFactory.createForClass(PriceItem);
PriceItemSchema.index({ category: 1, isActive: 1, name: 1 });
