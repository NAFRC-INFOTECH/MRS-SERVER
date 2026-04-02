import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DoctorsController } from './doctors.controller';
import { UsersModule } from '../users/users.module';
import { DayListController } from './daylist.controller';
import { DayListService } from './daylist.service';
import { DoctorDayList, DoctorDayListSchema } from './daylist.schema';
import { VitalSign, VitalSignSchema } from '../gopd/vitals.schema';
import { DoctorReport, DoctorReportSchema } from './report.schema';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';

@Module({
  imports: [forwardRef(() => UsersModule), MongooseModule.forFeature([
    { name: DoctorDayList.name, schema: DoctorDayListSchema },
    { name: VitalSign.name, schema: VitalSignSchema },
    { name: DoctorReport.name, schema: DoctorReportSchema },
  ])],
  controllers: [DoctorsController, DayListController, ReportController],
  providers: [DayListService, ReportService],
})
export class DoctorsModule {}
