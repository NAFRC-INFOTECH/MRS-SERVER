import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DoctorReport, DoctorReportDocument } from './report.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(DoctorReport.name) private readonly model: Model<DoctorReportDocument>,
    private readonly usersService: UsersService
  ) {}

  async add(payload: { patientId: string; senderId: string; text?: string; clinicalNote?: string; diagnosis?: string; imageUrl?: string; replyToId?: string }) {
    if (!payload.text && !payload.clinicalNote && !payload.diagnosis && !payload.imageUrl) {
      throw new BadRequestException('clinical note, diagnosis, text or imageUrl required');
    }
    const sender = await this.usersService.findById(payload.senderId);
    const doc = new this.model({
      patientId: new Types.ObjectId(payload.patientId),
      senderId: new Types.ObjectId(payload.senderId),
      senderName: sender?.name || 'Doctor',
      text: payload.text,
      clinicalNote: payload.clinicalNote,
      diagnosis: payload.diagnosis,
      imageUrl: payload.imageUrl,
      replyToId: payload.replyToId ? new Types.ObjectId(payload.replyToId) : undefined,
    });
    const saved = await doc.save();
    return this.mapReport(saved.toObject());
  }

  async list(patientId: string) {
    const pid = new Types.ObjectId(patientId);
    const list = await this.model.find({ patientId: pid }).sort({ createdAt: 1 }).lean();
    return list.map((r: any) => this.mapReport(r));
  }

  async update(id: string, payload: { text?: string; clinicalNote?: string; diagnosis?: string; imageUrl?: string }) {
    const _id = new Types.ObjectId(id);
    const update: any = {};
    if (payload.text !== undefined) update.text = payload.text;
    if (payload.clinicalNote !== undefined) update.clinicalNote = payload.clinicalNote;
    if (payload.diagnosis !== undefined) update.diagnosis = payload.diagnosis;
    if (payload.imageUrl !== undefined) update.imageUrl = payload.imageUrl;
    const saved = await this.model.findByIdAndUpdate(_id, update, { new: true }).lean();
    if (!saved) throw new BadRequestException('Report not found');
    return this.mapReport(saved);
  }

  async remove(id: string) {
    const _id = new Types.ObjectId(id);
    const res = await this.model.findByIdAndDelete(_id).lean();
    if (!res) throw new BadRequestException('Report not found');
    return { id };
  }

  private mapReport(r: any) {
    return {
      id: String(r._id),
      patientId: String(r.patientId),
      senderId: String(r.senderId),
      senderName: r.senderName || 'Doctor',
      doctorName: r.senderName || 'Doctor',
      text: r.text,
      clinicalNote: r.clinicalNote || r.text,
      diagnosis: r.diagnosis,
      imageUrl: r.imageUrl,
      replyToId: r.replyToId ? String(r.replyToId) : undefined,
      createdAt: r.createdAt,
    };
  }
}
