import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { DutiesService } from './duties.service';
import { Shift, DutyStatus } from './duty.schema';

@ApiTags('duties')
@Controller({ path: 'duties', version: '1' })
export class DutiesController {
  constructor(private readonly svc: DutiesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'recording' as Role)
  @Post()
  async create(@Body() body: { role: 'doctor' | 'nurse'; staffId: string; departmentId: string; date: string; shift: Shift; timeIn: string; timeOut: string; status: DutyStatus; assignedBy: string; }) {
    return this.svc.create(body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Query() query: { role?: 'doctor' | 'nurse'; departmentId?: string; date?: string; shift?: Shift }) {
    return this.svc.list(query);
  }
}
