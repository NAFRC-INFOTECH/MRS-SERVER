import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { Patient, PatientSchema } from './patient.schema';
import { PharmacyPatient, PharmacyPatientSchema } from './pharmacy-patient.schema';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { GopdModule } from '../gopd/gopd.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { EventsModule } from '../events/events.module';
import { PatientCommandHandlers } from './cqrs/patients.handlers';
import { PatientsReplayService } from './projection/patients-replay.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Patient.name, schema: PatientSchema },
      { name: PharmacyPatient.name, schema: PharmacyPatientSchema },
    ]),
    CqrsModule,
    EventsModule,
    GopdModule,
    RealtimeModule,
  ],
  providers: [PatientsService, ...PatientCommandHandlers, PatientsReplayService],
  controllers: [PatientsController],
  exports: [PatientsService],
})
export class PatientsModule {}
