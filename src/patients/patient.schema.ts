import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PatientDocument = Patient & Document;

@Schema({ _id: false })
class NextOfKin {
  @Prop({ trim: true }) name: string;
  @Prop({ trim: true }) relationship: string;
  @Prop({ trim: true }) phone: string;
  @Prop({ trim: true }) address: string;
}

@Schema({ timestamps: true, collection: 'patients' })
export class Patient {
  @Prop({ trim: true }) surname: string;
  @Prop({ trim: true }) firstname: string;
  @Prop({ trim: true }) lastname: string;
  @Prop({ default: false }) veteran: boolean;
  @Prop({ trim: true }) serviceNumber?: string;
  @Prop({ trim: true }) rank?: string;

  @Prop({ trim: true }) sex: string;
  @Prop() age?: number;
  @Prop({ trim: true }) dateOfBirth?: string;

  @Prop({ trim: true }) country?: string;
  @Prop({ trim: true }) stateOfOrigin?: string;
  @Prop({ trim: true }) lga?: string;
  @Prop({ trim: true }) address?: string;
  @Prop({ trim: true }) religion?: string;
  @Prop({ trim: true }) maritalStatus?: string;
  @Prop({ trim: true }) phone?: string;
  @Prop({ trim: true }) occupation?: string;
  @Prop({ trim: true }) genotype?: string;
  @Prop({ trim: true }) bloodGroup?: string;

  @Prop({ type: NextOfKin }) nok?: NextOfKin;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);
