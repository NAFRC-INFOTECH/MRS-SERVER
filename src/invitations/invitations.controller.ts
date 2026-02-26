import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { InvitationsService } from './invitations.service';
import { AcceptInvitationDto } from './invitations.dto';

@ApiTags('invitations')
@Controller({ path: 'invitations', version: '1' })
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) { }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Post('doctor')
  async inviteDoctor(@Req() req: { user: { userId: string } }, @Body() dto: { email: string }) {
    const doc = await this.invitationsService.inviteDoctor(dto.email, req.user?.userId);
    return { token: doc.token, email: doc.email, role: doc.role, status: doc.status };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Post('doctor/direct')
  async createDoctorDirect(@Body() dto: { name: string; email: string }) {
    const res = await this.invitationsService.createDoctorDirect(dto.name, dto.email);
    return res; // { id, email, name, password }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Post('nurse')
  async inviteNurse(@Req() req: { user: { userId: string } }, @Body() dto: { email: string }) {
    const inv = await this.invitationsService.inviteNurse(dto.email, req.user?.userId);
    return { token: inv.token, email: inv.email, role: inv.role, status: inv.status };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Post('nurse/direct')
  async createNurseDirect(@Body() dto: { name: string; email: string }) {
    const res = await this.invitationsService.createNurseDirect(dto.name, dto.email);
    return res; // { id, email, name, password }
  }

  @Get(':token')
  async verifyInvitation(@Param('token') token: string) {
    const inv = await this.invitationsService.findByToken(token);
    if (!inv) return { valid: false };
    return { valid: inv.status === 'pending', email: inv.email, role: inv.role, status: inv.status };
  }

  @Post('accept')
  async accept(@Body() dto: AcceptInvitationDto) {
    return this.invitationsService.acceptByToken(dto.token, dto.email, dto.password, dto.name);
  }
}
