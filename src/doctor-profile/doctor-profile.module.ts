import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DoctorProfile, DoctorProfileSchema } from './doctor-profile.schema';
import { DoctorProfileController } from './doctor-profile.controller';
import { DoctorProfileService } from './doctor-profile.service';
import { ConfigModule } from '@nestjs/config';
import { PasswordService } from '../common/security/password';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: DoctorProfile.name, schema: DoctorProfileSchema }])
  ],
  controllers: [DoctorProfileController],
  providers: [DoctorProfileService, PasswordService],
  exports: [DoctorProfileService],
})
export class DoctorProfileModule {}
