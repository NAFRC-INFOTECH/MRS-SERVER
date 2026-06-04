import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Invoice, InvoiceSchema } from '../invoices/invoice.schema';
import { LabReferral, LabReferralSchema } from './lab-referral.schema';
import { LabReferralsService } from './lab-referrals.service';
import { LabReferralsController } from './lab-referrals.controller';
 
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LabReferral.name, schema: LabReferralSchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
  ],
  controllers: [LabReferralsController],
  providers: [LabReferralsService],
  exports: [LabReferralsService]
})
export class LabReferralsModule {}
