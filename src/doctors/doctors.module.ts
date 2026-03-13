import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DoctorsController } from './doctors.controller';
import { UsersModule } from '../users/users.module';
import { DayListController } from './daylist.controller';
import { DayListService } from './daylist.service';
import { DoctorDayList, DoctorDayListSchema } from './daylist.schema';
import { VitalSign, VitalSignSchema } from '../gopd/vitals.schema';

@Module({
  imports: [forwardRef(() => UsersModule), MongooseModule.forFeature([{ name: DoctorDayList.name, schema: DoctorDayListSchema }, { name: VitalSign.name, schema: VitalSignSchema }])],
  controllers: [DoctorsController, DayListController],
  providers: [DayListService],
})
export class DoctorsModule {}
