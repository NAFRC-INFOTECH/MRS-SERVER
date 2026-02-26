import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { Admin, AdminSchema } from '../admin/schemas/admin.schema';
import { PasswordService } from '../common/security/password';
import { ConfigModule } from '@nestjs/config';
import { DoctorProfileModule } from '../doctor-profile/doctor-profile.module';
import { UsersRolesMaintenanceController } from './users_roles_maintenance.controller';

@Module({
  imports: [
    ConfigModule,
    DoctorProfileModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }, { name: Admin.name, schema: AdminSchema }])
  ],
  controllers: [UsersController, UsersRolesMaintenanceController],
  providers: [UsersService, PasswordService],
  exports: [UsersService]
})
export class UsersModule {}
