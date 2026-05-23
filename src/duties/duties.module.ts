import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { DutyRecord, DutyRecordSchema } from './duty.schema';
import { DutiesController } from './duties.controller';
import { DutiesService } from './duties.service';
import { UsersModule } from '../users/users.module';
import { DepartmentsModule } from '../departments/departments.module';
import { EventsModule } from '../events/events.module';
import { DutyCommandHandlers } from './cqrs/duties.handlers';
import { DutiesReplayService } from './projection/duties-replay.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DutyRecord.name, schema: DutyRecordSchema }]),
    CqrsModule,
    EventsModule,
    UsersModule,
    DepartmentsModule
  ],
  controllers: [DutiesController],
  providers: [DutiesService, ...DutyCommandHandlers, DutiesReplayService],
  exports: [DutiesService]
})
export class DutiesModule {}
