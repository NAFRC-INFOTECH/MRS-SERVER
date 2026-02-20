import { Controller, Get, Param, Patch, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { AssignRolesDto } from './dto/assign-roles.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Get(':email')
  async findByEmail(@Param('email') email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const obj = user.toObject();
    delete obj.passwordHash;
    delete obj.refreshTokenHash;
    return obj;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.update(id, dto);
    const obj = user.toObject();
    delete obj.passwordHash;
    delete obj.refreshTokenHash;
    return obj;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Patch(':id/roles')
  async assignRoles(@Param('id') id: string, @Body() dto: AssignRolesDto) {
    const user = await this.usersService.assignRoles(id, dto.roles);
    const obj = user.toObject();
    delete obj.passwordHash;
    delete obj.refreshTokenHash;
    return obj;
  }
}
