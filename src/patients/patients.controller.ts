import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { PatientsService } from './patients.service';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'patients', version: '1' })
export class PatientsController {
  constructor(private readonly svc: PatientsService) {}

  @Roles('super_admin' as Role, 'recording' as Role)
  @Get()
  async list(@Query('q') q?: string) {
    return this.svc.list(q);
  }

  @Roles('super_admin' as Role, 'recording' as Role)
  @Post()
  async create(@Body() body: any) {
    const doc = await this.svc.create(body);
    return doc.toObject();
  }

  @Roles('super_admin' as Role, 'recording' as Role)
  @Get(':id')
  async get(@Param('id') id: string) {
    const doc = await this.svc.findById(id);
    return doc ? doc.toObject() : null;
  }

  @Roles('super_admin' as Role, 'recording' as Role)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const doc = await this.svc.update(id, body);
    return doc.toObject();
  }
  @Roles('super_admin' as Role, 'recording' as Role)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.svc.remove(id);
    return { ok: true };
  }
}
