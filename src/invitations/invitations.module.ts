import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { Invitation, InvitationSchema } from './invitations.schema';
import { UsersModule } from '../users/users.module';
import { DoctorProfileModule } from '../doctor-profile/doctor-profile.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Invitation.name, schema: InvitationSchema }]),
    UsersModule,
    DoctorProfileModule,
    MailerModule   // ← explicitly import so MailerService is available to InvitationsService
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule { }
