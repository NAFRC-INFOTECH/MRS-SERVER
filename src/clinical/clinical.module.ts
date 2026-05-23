import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClinicalDayListController } from './daylist.controller';
import { ClinicalDayListService } from './daylist.service';
import { ClinicalDayList, ClinicalDayListSchema } from './daylist.schema';
import { VitalSign, VitalSignSchema } from '../gopd/vitals.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClinicalDayList.name, schema: ClinicalDayListSchema },
      { name: VitalSign.name, schema: VitalSignSchema }
    ])
  ],
  controllers: [ClinicalDayListController],
  providers: [ClinicalDayListService]
})
export class ClinicalModule {}

