import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { UsersService } from './users.service';
import { DoctorProfileService } from '../doctor-profile/doctor-profile.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersRolesMaintenanceController {
  constructor(
    private readonly usersService: UsersService,
    private readonly doctorProfileService: DoctorProfileService
  ) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('super_admin' as Role)
    @Post('roles/normalize-doctors')
    async normalizeDoctors() {
      const withDoctor = await this.usersService.findByRole('doctor');
      let updated = 0;
      for (const u of withDoctor) {
        const roles = (u.roles || []).filter((r) => r !== 'doctor');
        await this.usersService.assignRoles(String((u as any)._id), roles);
        try {
          await this.doctorProfileService.createSkeleton(String((u as any)._id), (u as any).email, (u as any).name);
        } catch {
          /* ignore */
        }
        updated++;
      }
      return { ok: true, normalized: updated };
    }
}
