import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Admin, AdminSchema } from './schemas/admin.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PasswordService } from '../common/security/password';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Admin.name, schema: AdminSchema }, { name: User.name, schema: UserSchema }])
  ],
  controllers: [AdminController],
  providers: [AdminService, PasswordService],
  exports: [AdminService]
})
export class AdminModule {}
