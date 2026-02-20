import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';

@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Post('super-admin/signup')
  async signupSuperAdmin(@Body() dto: { name: string; email: string; password: string }) {
    const admin = await this.adminService.create(dto);
    const obj = admin.toObject();
    const safe = { ...obj };
    delete safe.passwordHash;
    delete safe.refreshTokenHash;
    return safe;
  }
}
