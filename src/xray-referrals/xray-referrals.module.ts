import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Invoice, InvoiceSchema } from '../invoices/invoice.schema';
import { XrayReferral, XrayReferralSchema } from './xray-referral.schema';
import { XrayReferralsService } from './xray-referrals.service';
import { XrayReferralsController } from './xray-referrals.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: XrayReferral.name, schema: XrayReferralSchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
  ],
  controllers: [XrayReferralsController],
  providers: [XrayReferralsService],
  exports: [XrayReferralsService],
})
export class XrayReferralsModule {}
