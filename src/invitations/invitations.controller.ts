import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { InvitationsService } from './invitations.service';

@ApiTags('invitations')
@Controller({ path: 'invitations', version: '1' })
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Post('doctor')
  async inviteDoctor(@Body() dto: { email: string }) {
    const doc = await this.invitationsService.inviteDoctor(dto.email);
    return { token: doc.token, email: doc.email, role: doc.role, status: doc.status };
  }

  @Get(':token')
  async verifyInvitation(@Param('token') token: string) {
    const inv = await this.invitationsService.findByToken(token);
    if (!inv) return { valid: false };
    return { valid: inv.status === 'pending', email: inv.email, role: inv.role, status: inv.status };
  }
}
