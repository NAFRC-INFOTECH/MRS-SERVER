import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DepartmentDocument = Department & Document;

@Schema({ timestamps: true, collection: 'departments' })
export class Department {
  @Prop({ trim: true, unique: true })
  name: string;

  @Prop({ trim: true })
  description?: string;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
