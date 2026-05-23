import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { EventRecord, EventRecordSchema } from './event-record.schema';
import { EventSequence, EventSequenceSchema } from './event-sequence.schema';
import { EventStoreService } from './event-store.service';
import { EventsController } from './events.controller';

@Module({
  imports: [
    CqrsModule,
    MongooseModule.forFeature([
      { name: EventRecord.name, schema: EventRecordSchema },
      { name: EventSequence.name, schema: EventSequenceSchema }
    ])
  ],
  controllers: [EventsController],
  providers: [EventStoreService],
  exports: [EventStoreService]
})
export class EventsModule {}
