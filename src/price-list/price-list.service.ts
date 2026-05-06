import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PriceCategory, PriceItem, PriceItemDocument } from './price-item.schema';
import { CreatePriceItemDto } from './dto/create-price-item.dto';
import { UpdatePriceItemDto } from './dto/update-price-item.dto';

export type ListPriceItemsQuery = {
  q?: string;
  category?: string;
  activeOnly?: boolean;
};

@Injectable()
export class PriceListService implements OnModuleInit {
  constructor(
    @InjectModel(PriceItem.name)
    private readonly priceItemModel: Model<PriceItemDocument>,
  ) {}

  async onModuleInit() {
    await this.priceItemModel.syncIndexes();
  }

  async list(query: ListPriceItemsQuery): Promise<PriceItemDocument[]> {
    const filter: any = {};

    if (query.category) {
      filter.category = query.category;
    }

    if (query.activeOnly) {
      filter.isActive = true;
    }

    if (query.q && query.q.trim().length > 0) {
      const search = new RegExp(query.q.trim(), 'i');
      filter.$or = [{ name: search }, { description: search }, { unit: search }];
    }

    return this.priceItemModel.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
  }

  async findOne(id: string): Promise<PriceItemDocument> {
    const doc = await this.priceItemModel.findById(id);
    if (!doc) throw new NotFoundException('Price item not found');
    return doc;
  }

  async create(dto: CreatePriceItemDto): Promise<PriceItemDocument> {
    this.validatePrice(dto.price);

    const doc = new this.priceItemModel({
      name: dto.name.trim(),
      category: dto.category,
      description: dto.description?.trim() || '',
      unit: dto.unit?.trim() || 'per item',
      price: dto.price,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });

    return doc.save();
  }

  async update(id: string, dto: UpdatePriceItemDto): Promise<PriceItemDocument> {
    const update: any = {};

    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.category !== undefined) update.category = dto.category;
    if (dto.description !== undefined) update.description = dto.description.trim();
    if (dto.unit !== undefined) update.unit = dto.unit.trim() || 'per item';
    if (dto.price !== undefined) {
      this.validatePrice(dto.price);
      update.price = dto.price;
    }
    if (dto.isActive !== undefined) update.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) update.sortOrder = dto.sortOrder;

    const doc = await this.priceItemModel.findByIdAndUpdate(id, update, { new: true });
    if (!doc) throw new NotFoundException('Price item not found');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.priceItemModel.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('Price item not found');
    return { ok: true };
  }

  private validatePrice(price: number) {
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException('Price must be a valid non-negative number');
    }
  }
}
