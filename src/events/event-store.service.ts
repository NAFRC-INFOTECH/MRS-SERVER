import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { EventRecord, EventRecordDocument } from './event-record.schema';
import { EventSequence, EventSequenceDocument } from './event-sequence.schema';

export type AppendEventInput = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  occurredAt?: Date;
  version?: number;
  payload: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

@Injectable()
export class EventStoreService {
  constructor(
    @InjectModel(EventRecord.name) private readonly model: Model<EventRecordDocument>,
    @InjectModel(EventSequence.name) private readonly seqModel: Model<EventSequenceDocument>
  ) {}

  private async nextSeq(): Promise<number> {
    const doc = await this.seqModel.findOneAndUpdate(
      { name: 'event_store' },
      { $inc: { value: 1 } },
      { new: true, upsert: true }
    );
    return Number((doc as any).value || 0);
  }

  async append(input: AppendEventInput) {
    const seq = await this.nextSeq();
    const doc = new this.model({
      seq,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      version: input.version,
      occurredAt: input.occurredAt ?? new Date(),
      payload: input.payload || {},
      meta: input.meta || {}
    });
    const saved = await doc.save();
    return saved.toObject();
  }

  async list(filters?: {
    aggregateType?: string;
    aggregateId?: string;
    eventType?: string;
    from?: string;
    to?: string;
    limit?: number;
    skip?: number;
  }) {
    const q: any = {};
    if (filters?.aggregateType) q.aggregateType = String(filters.aggregateType).trim();
    if (filters?.aggregateId) q.aggregateId = String(filters.aggregateId).trim();
    if (filters?.eventType) q.eventType = String(filters.eventType).trim();
    if (filters?.from || filters?.to) {
      const range: any = {};
      if (filters.from) range.$gte = new Date(filters.from);
      if (filters.to) range.$lte = new Date(filters.to);
      q.occurredAt = range;
    }
    const limit = Math.min(Math.max(Number(filters?.limit || 50), 1), 500);
    const skip = Math.max(Number(filters?.skip || 0), 0);
    return this.model.find(q).sort({ occurredAt: -1 }).skip(skip).limit(limit).lean();
  }

  async scan(filters?: { aggregateType?: string; eventType?: string }) {
    const q: any = {};
    if (filters?.aggregateType) q.aggregateType = String(filters.aggregateType).trim();
    if (filters?.eventType) q.eventType = String(filters.eventType).trim();
    return this.model.find(q).sort({ seq: 1 }).lean();
  }
}
