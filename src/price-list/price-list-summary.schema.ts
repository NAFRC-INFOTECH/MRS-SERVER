import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PriceListSummaryDocument = PriceListSummary & Document;

export enum SummaryPeriod {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Schema({ timestamps: true, collection: 'price_list_summaries' })
export class PriceListSummary {
  @Prop({ type: String, enum: SummaryPeriod, required: true })
  period: SummaryPeriod;

  @Prop({ required: true })
  referenceDate: string;

  @Prop({ default: 0 })
  totalItems: number;

  @Prop({ default: 0 })
  activeItems: number;

  @Prop({ default: 0 })
  drugs: number;

  @Prop({ default: 0 })
  totalDrugs: number;

  @Prop({ default: 0 })
  services: number;

  @Prop({ default: 0 })
  totalValue: number;

  @Prop({ default: 0 })
  totalDrugsInStock: number;

  @Prop({ default: 0 })
  totalDrugsSold: number;

  @Prop({ default: 0 })
  totalDrugsSoldValue: number;
}

export const PriceListSummarySchema = SchemaFactory.createForClass(PriceListSummary);
PriceListSummarySchema.index({ period: 1, referenceDate: 1 }, { unique: true });
