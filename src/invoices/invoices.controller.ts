import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { InvoicesService } from './invoices.service';
import { PaymentStatus } from './invoice.schema';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'pharmacy' as Role, 'nurse' as Role)
  @Post()
  async create(@Body() body: { patientId: string; drugs: any[] }) {
    return this.invoicesService.create(body.patientId, body.drugs);
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'pharmacy' as Role, 'nurse' as Role)
  @Get('patient/:patientId')
  async findByPatientId(@Param('patientId') patientId: string) {
    return this.invoicesService.findByPatientId(patientId);
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'pharmacy' as Role, 'nurse' as Role)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'paypoint' as Role)
  @Patch(':id/payment-status')
  async updatePaymentStatus(
    @Param('id') id: string,
    @Body() body: { paymentStatus: PaymentStatus },
  ) {
    return this.invoicesService.updatePaymentStatus(id, body.paymentStatus);
  }
}
