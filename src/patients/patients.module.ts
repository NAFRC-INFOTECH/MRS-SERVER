import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Patient, PatientSchema } from './patient.schema';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { GopdModule } from '../gopd/gopd.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Patient.name, schema: PatientSchema }]), GopdModule],
  providers: [PatientsService],
  controllers: [PatientsController],
  exports: [PatientsService],
})
export class PatientsModule {}
