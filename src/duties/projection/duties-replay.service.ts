import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { EventStoreService } from '../../events/event-store.service';
import { DutyRecord, DutyRecordDocument } from '../duty.schema';

@Injectable()
export class DutiesReplayService {
  constructor(
    private readonly events: EventStoreService,
    @InjectModel(DutyRecord.name) private readonly dutyModel: Model<DutyRecordDocument>
  ) {}

  async rebuildFromEvents() {
    await this.dutyModel.deleteMany({});
    const stream = await this.events.scan({ aggregateType: 'Duty' });
    for (const e of stream as any[]) {
      if (e.eventType === 'DutyCreated') {
        const duty = (e.payload || {}).duty;
        if (!duty) continue;
        await this.dutyModel.updateOne({ _id: duty._id }, { $set: duty }, { upsert: true });
      } else if (e.eventType === 'DutyUpdated') {
        const duty = (e.payload || {}).duty;
        if (!duty?._id) continue;
        await this.dutyModel.updateOne({ _id: duty._id }, { $set: duty }, { upsert: true });
      } else if (e.eventType === 'DutyDeleted') {
        const dutyId = (e.payload || {}).dutyId || e.aggregateId;
        if (!dutyId) continue;
        await this.dutyModel.deleteOne({ _id: dutyId });
      }
    }
    return { ok: true };
  }
}

