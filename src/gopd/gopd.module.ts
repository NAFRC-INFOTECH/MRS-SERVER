import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GopdQueue, GopdQueueSchema } from './gopd-queue.schema';
import { GopdQueueService } from './gopd-queue.service';
import { GopdQueueController } from './gopd-queue.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: GopdQueue.name, schema: GopdQueueSchema }])],
  providers: [GopdQueueService],
  controllers: [GopdQueueController],
  exports: [GopdQueueService],
})
export class GopdModule {}
