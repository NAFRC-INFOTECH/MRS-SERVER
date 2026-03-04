import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Department, DepartmentDocument } from './department.schema';

@Injectable()
export class DepartmentsService {
  constructor(@InjectModel(Department.name) private readonly model: Model<DepartmentDocument>) {}

  async list(): Promise<DepartmentDocument[]> {
    return this.model.find().lean();
  }

  async create(name: string, description?: string): Promise<DepartmentDocument> {
    const doc = new this.model({ name, description });
    return doc.save();
  }

  async update(id: string, patch: { name?: string; description?: string }): Promise<DepartmentDocument> {
    const doc = await this.model.findByIdAndUpdate(id, patch, { new: true });
    return doc as DepartmentDocument;
  }

  async remove(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id);
  }
}
