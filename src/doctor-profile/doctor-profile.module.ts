import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DoctorProfile, DoctorProfileSchema } from './doctor-profile.schema';
import { DoctorProfileController } from './doctor-profile.controller';
import { DoctorProfileService } from './doctor-profile.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: DoctorProfile.name, schema: DoctorProfileSchema }])
  ],
  controllers: [DoctorProfileController],
  providers: [DoctorProfileService],
  exports: [DoctorProfileService],
})
export class DoctorProfileModule {}
