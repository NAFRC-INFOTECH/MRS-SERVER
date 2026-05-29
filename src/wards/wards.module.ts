import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Patient, PatientSchema } from '../patients/patient.schema';
import { PriceListModule } from '../price-list/price-list.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WardAdmission, WardAdmissionSchema } from './ward-admission.schema';
import { WardsController } from './wards.controller';
import { WardsService } from './wards.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WardAdmission.name, schema: WardAdmissionSchema },
      { name: Patient.name, schema: PatientSchema },
    ]),
    PriceListModule,
    RealtimeModule,
  ],
  controllers: [WardsController],
  providers: [WardsService],
})
export class WardsModule {}

