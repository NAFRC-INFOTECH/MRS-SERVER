import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PriceItem, PriceItemSchema } from './price-item.schema';
import { PriceListController } from './price-list.controller';
import { PriceListService } from './price-list.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PriceItem.name, schema: PriceItemSchema }]),
  ],
  controllers: [PriceListController],
  providers: [PriceListService],
  exports: [PriceListService],
})
export class PriceListModule {}
