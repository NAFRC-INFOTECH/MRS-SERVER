import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { EventStoreService } from '../../events/event-store.service';
import { Invoice, InvoiceDocument } from '../invoice.schema';

@Injectable()
export class InvoicesReplayService {
  constructor(
    private readonly events: EventStoreService,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>
  ) {}

  async rebuildFromEvents() {
    await this.invoiceModel.deleteMany({});
    const stream = await this.events.scan({ aggregateType: 'Invoice' });
    for (const e of stream as any[]) {
      if (e.eventType === 'InvoiceCreated') {
        const invoice = (e.payload || {}).invoice;
        if (!invoice?._id) continue;
        await this.invoiceModel.updateOne({ _id: invoice._id }, { $set: invoice }, { upsert: true });
      } else if (e.eventType === 'InvoicePaymentStatusUpdated') {
        const invoice = (e.payload || {}).invoice;
        if (!invoice?._id) continue;
        await this.invoiceModel.updateOne({ _id: invoice._id }, { $set: invoice }, { upsert: true });
      }
    }
    return { ok: true };
  }
}

