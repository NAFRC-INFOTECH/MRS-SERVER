import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { DoctorProfileService } from './doctor-profile.service';
import { DoctorProfile } from './doctor-profile.schema';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

@ApiTags('doctor-profiles')
@Controller({ path: 'doctor-profiles', version: '1' })
export class DoctorProfileController {
  constructor(private readonly profileService: DoctorProfileService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Get()
  async listAll() {
    const list = await this.profileService.listAll();
    return list.map((p) => p);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: { userId: string } }) {
    const profile = await this.profileService.findByUserId(req.user.userId);
    return profile;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @Req() req: { user: { userId: string } },
    @Body() patch: DeepPartial<DoctorProfile>
  ) {
    const profile = await this.profileService.updateForUser(req.user.userId, patch);
    return profile;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/complete')
  async complete(@Req() req: { user: { userId: string } }) {
    const profile = await this.profileService.completeOnboarding(req.user.userId);
    return profile;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Patch(':userId/status')
  async updateStatus(@Param('userId') userId: string, @Body() body: { status: string }) {
    const profile = await this.profileService.updateStatus(userId, body.status);
    return profile;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Delete(':userId')
  async remove(@Param('userId') userId: string) {
    return this.profileService.deleteByUserId(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Patch(':userId/reset-password')
  async resetPassword(@Param('userId') userId: string) {
    return this.profileService.resetPassword(userId);
  }
}
