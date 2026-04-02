import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DoctorReport, DoctorReportDocument } from './report.schema';

@Injectable()
export class ReportService {
  constructor(@InjectModel(DoctorReport.name) private readonly model: Model<DoctorReportDocument>) {}

  async add(payload: { patientId: string; senderId: string; text?: string; imageUrl?: string; replyToId?: string }) {
    if (!payload.text && !payload.imageUrl) throw new BadRequestException('text or imageUrl required');
    const doc = new this.model({
      patientId: new Types.ObjectId(payload.patientId),
      senderId: new Types.ObjectId(payload.senderId),
      text: payload.text,
      imageUrl: payload.imageUrl,
      replyToId: payload.replyToId ? new Types.ObjectId(payload.replyToId) : undefined,
    });
    const saved = await doc.save();
    return saved.toObject();
  }

  async list(patientId: string) {
    const pid = new Types.ObjectId(patientId);
    const list = await this.model.find({ patientId: pid }).sort({ createdAt: 1 }).lean();
    return list.map((r: any) => ({
      id: String(r._id),
      patientId: String(r.patientId),
      senderId: String(r.senderId),
      text: r.text,
      imageUrl: r.imageUrl,
      replyToId: r.replyToId ? String(r.replyToId) : undefined,
      createdAt: r.createdAt,
    }));
  }

  async update(id: string, payload: { text?: string; imageUrl?: string }) {
    const _id = new Types.ObjectId(id);
    const update: any = {};
    if (payload.text !== undefined) update.text = payload.text;
    if (payload.imageUrl !== undefined) update.imageUrl = payload.imageUrl;
    const saved = await this.model.findByIdAndUpdate(_id, update, { new: true }).lean();
    if (!saved) throw new BadRequestException('Report not found');
    return {
      id: String(saved._id),
      patientId: String(saved.patientId),
      senderId: String(saved.senderId),
      text: saved.text,
      imageUrl: saved.imageUrl,
      replyToId: saved.replyToId ? String(saved.replyToId) : undefined,
      createdAt: (saved as any).createdAt,
    };
  }

  async remove(id: string) {
    const _id = new Types.ObjectId(id);
    const res = await this.model.findByIdAndDelete(_id).lean();
    if (!res) throw new BadRequestException('Report not found');
    return { id };
  }
}
