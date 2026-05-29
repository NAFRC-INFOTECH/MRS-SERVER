import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { Invoice, InvoiceSchema } from './invoice.schema';
import { Patient, PatientSchema } from '../patients/patient.schema';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { EventsModule } from '../events/events.module';
import { InvoiceCommandHandlers } from './cqrs/invoices.handlers';
import { InvoicesReplayService } from './projection/invoices-replay.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Patient.name, schema: PatientSchema },
    ]),
    CqrsModule,
    EventsModule
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, ...InvoiceCommandHandlers, InvoicesReplayService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
