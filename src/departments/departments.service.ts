import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Department, DepartmentDocument } from './department.schema';

@Injectable()
export class DepartmentsService implements OnModuleInit {
  constructor(@InjectModel(Department.name) private readonly model: Model<DepartmentDocument>) {}

  async onModuleInit() {
    const wardUnits = ['ChildrenWard', 'FemaleWard', 'MaleWard', 'MaleVIP', 'FemaleVIP'];
    const names = ['Ward', ...wardUnits, 'Antenatal'];
    const existing = await this.model.find().select({ name: 1 }).lean();
    const normalize = (value: string) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');
    const existingKeys = new Set((existing as any[]).map((d) => normalize(String(d?.name || ''))).filter(Boolean));
    for (const name of names) {
      const key = normalize(name);
      if (existingKeys.has(key)) continue;
      await this.model.create({ name, bedCapacity: wardUnits.includes(name) ? 5 : undefined });
      existingKeys.add(key);
    }
  }

  async list(): Promise<DepartmentDocument[]> {
    return this.model.find().lean();
  }

  async create(name: string, description?: string): Promise<DepartmentDocument> {
    const doc = new this.model({ name, description });
    return doc.save();
  }

  async update(id: string, patch: { name?: string; description?: string; bedCapacity?: number }): Promise<DepartmentDocument> {
    if (patch.bedCapacity !== undefined && patch.bedCapacity !== null) {
      const v = Number(patch.bedCapacity);
      if (!Number.isFinite(v) || !Number.isInteger(v)) throw new BadRequestException('bedCapacity must be an integer');
      if (v < 5 || v > 50) throw new BadRequestException('bedCapacity must be between 5 and 50');
      patch.bedCapacity = v;
    }
    const doc = await this.model.findByIdAndUpdate(id, patch, { new: true });
    return doc as DepartmentDocument;
  }

  async remove(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id);
  }
}
