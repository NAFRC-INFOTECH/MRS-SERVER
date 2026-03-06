import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DutyRecord, DutyRecordSchema } from './duty.schema';
import { DutiesController } from './duties.controller';
import { DutiesService } from './duties.service';
import { UsersModule } from '../users/users.module';
import { DepartmentsModule } from '../departments/departments.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DutyRecord.name, schema: DutyRecordSchema }]),
    UsersModule,
    DepartmentsModule
  ],
  controllers: [DutiesController],
  providers: [DutiesService],
  exports: [DutiesService]
})
export class DutiesModule {}
