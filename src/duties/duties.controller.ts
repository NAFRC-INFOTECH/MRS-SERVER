import { Body, Controller, Get, Post, Query, UseGuards, Req } from '@nestjs/common';
import { Param, Patch, Delete, ForbiddenException } from '@nestjs/common';
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

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'recording' as Role, 'nurse' as Role, 'doctor' as Role)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Partial<{ departmentId: string; date: string; shift: Shift; timeIn: string; timeOut: string; status: DutyStatus }>, @Req() req: any) {
    const duty = await this.svc.getById(id);
    if (!duty) throw new ForbiddenException('Duty not found');
    const roles: string[] = (req.user?.roles || []) as string[];
    const userId: string = req.user?.sub;
    if (roles.includes('nurse') && String(duty.nurseUserId) !== String(userId)) {
      throw new ForbiddenException('Cannot edit other nurse duty');
    }
    if (roles.includes('doctor') && String(duty.doctorUserId) !== String(userId)) {
      throw new ForbiddenException('Cannot edit other doctor duty');
    }
    return this.svc.update(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'recording' as Role, 'nurse' as Role, 'doctor' as Role)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const duty = await this.svc.getById(id);
    if (!duty) throw new ForbiddenException('Duty not found');
    const roles: string[] = (req.user?.roles || []) as string[];
    const userId: string = req.user?.sub;
    if (roles.includes('nurse') && String(duty.nurseUserId) !== String(userId)) {
      throw new ForbiddenException('Cannot delete other nurse duty');
    }
    if (roles.includes('doctor') && String(duty.doctorUserId) !== String(userId)) {
      throw new ForbiddenException('Cannot delete other doctor duty');
    }
    return this.svc.remove(id);
  }
}
