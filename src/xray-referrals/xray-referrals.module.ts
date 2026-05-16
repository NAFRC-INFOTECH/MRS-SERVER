import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { XrayReferral, XrayReferralSchema } from './xray-referral.schema';
import { XrayReferralsService } from './xray-referrals.service';
import { XrayReferralsController } from './xray-referrals.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: XrayReferral.name, schema: XrayReferralSchema }])],
  controllers: [XrayReferralsController],
  providers: [XrayReferralsService],
  exports: [XrayReferralsService],
})
export class XrayReferralsModule {}

