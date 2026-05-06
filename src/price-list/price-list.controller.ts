import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PriceListService } from './price-list.service';
import { CreatePriceItemDto } from './dto/create-price-item.dto';
import { UpdatePriceItemDto } from './dto/update-price-item.dto';
import { PriceCategory } from './price-item.schema';

@ApiTags('Price List')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'price-list', version: '1' })
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('category') category?: PriceCategory,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.priceListService.list({
      q,
      category,
      activeOnly: activeOnly === 'true',
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.priceListService.findOne(id);
  }

  @Post()
  @Roles('super_admin', 'admin')
  async create(@Body() dto: CreatePriceItemDto) {
    return this.priceListService.create(dto);
  }

  @Patch(':id')
  @Roles('super_admin', 'admin')
  async update(@Param('id') id: string, @Body() dto: UpdatePriceItemDto) {
    return this.priceListService.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  async remove(@Param('id') id: string) {
    return this.priceListService.remove(id);
  }
}
