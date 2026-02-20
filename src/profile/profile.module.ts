import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { AdminModule } from '../admin/admin.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AdminModule, UsersModule],
  controllers: [ProfileController]
})
export class ProfileModule {}
