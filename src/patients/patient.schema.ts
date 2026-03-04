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
  @Prop({ trim: true, required: true }) surname: string;
  @Prop({ trim: true, required: true }) firstname: string;
  @Prop({ trim: true }) middlename: string;
  @Prop({ default: false }) veteran: boolean;
  @Prop({ trim: true, required: function (this: any) { return !!this.veteran; } }) serviceNumber?: string;
  @Prop({ trim: true, required: function (this: any) { return !!this.veteran; } }) rank?: string;
  @Prop({ trim: true, required: function (this: any) { return !this.veteran; } }) membershipNumber?: string;

  @Prop({ trim: true, required: true }) sex: string;
  @Prop({ required: true }) age?: number;
  @Prop({ trim: true, required: true }) dateOfBirth?: string;

  @Prop({ trim: true, required: true }) country?: string;
  @Prop({ trim: true, required: true }) stateOfOrigin?: string;
  @Prop({ trim: true }) lga?: string;
  @Prop({ trim: true }) address?: string;
  @Prop({ trim: true }) religion?: string;
  @Prop({ trim: true, required: true }) maritalStatus?: string;
  @Prop({ trim: true, required: true }) phone?: string;
  @Prop({ trim: true }) occupation?: string;
  @Prop({ trim: true }) genotype?: string;
  @Prop({ trim: true }) bloodGroup?: string;
  @Prop({ trim: true, default: 'active' }) patientStatus?: string;
  @Prop({ trim: true }) patientQueue?: string;

  @Prop({ type: NextOfKin }) nok?: NextOfKin;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);
