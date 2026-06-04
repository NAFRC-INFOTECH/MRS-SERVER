import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PriceItem, PriceItemSchema } from './price-item.schema';
import { PriceListSummary, PriceListSummarySchema } from './price-list-summary.schema';
import { PriceListController } from './price-list.controller';
import { PriceListService } from './price-list.service';
import { Invoice, InvoiceSchema } from '../invoices/invoice.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PriceItem.name, schema: PriceItemSchema },
      { name: PriceListSummary.name, schema: PriceListSummarySchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
  ],
  controllers: [PriceListController],
  providers: [PriceListService],
  exports: [PriceListService],
})
export class PriceListModule {}
