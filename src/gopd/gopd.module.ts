import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GopdQueue, GopdQueueSchema } from './gopd-queue.schema';
import { GopdQueueService } from './gopd-queue.service';
import { GopdQueueController } from './gopd-queue.controller';
import { VitalSign, VitalSignSchema } from './vitals.schema';
import { VitalsService } from './vitals.service';
import { VitalsController } from './vitals.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: GopdQueue.name, schema: GopdQueueSchema }, { name: VitalSign.name, schema: VitalSignSchema }])],
  providers: [GopdQueueService, VitalsService],
  controllers: [GopdQueueController, VitalsController],
  exports: [GopdQueueService, VitalsService],
})
export class GopdModule {}
