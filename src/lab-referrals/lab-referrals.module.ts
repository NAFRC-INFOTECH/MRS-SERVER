import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LabReferral, LabReferralSchema } from './lab-referral.schema';
import { LabReferralsService } from './lab-referrals.service';
import { LabReferralsController } from './lab-referrals.controller';
 
@Module({
  imports: [MongooseModule.forFeature([{ name: LabReferral.name, schema: LabReferralSchema }])],
  controllers: [LabReferralsController],
  providers: [LabReferralsService],
  exports: [LabReferralsService]
})
export class LabReferralsModule {}
