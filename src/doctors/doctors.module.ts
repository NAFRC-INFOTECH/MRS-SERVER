import { Module, forwardRef } from '@nestjs/common';
import { DoctorsController } from './doctors.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [DoctorsController],
})
export class DoctorsModule {}
