import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PriceItem, PriceItemDocument } from './price-item.schema';
import { PriceListSummary, PriceListSummaryDocument } from './price-list-summary.schema';
import { CreatePriceItemDto } from './dto/create-price-item.dto';
import { UpdatePriceItemDto } from './dto/update-price-item.dto';

export type ListPriceItemsQuery = {
  q?: string;
  category?: string;
  activeOnly?: boolean;
};

export type SummaryPeriod = 'monthly' | 'yearly';

@Injectable()
export class PriceListService implements OnModuleInit {
  constructor(
    @InjectModel(PriceItem.name)
    private readonly priceItemModel: Model<PriceItemDocument>,
    @InjectModel(PriceListSummary.name)
    private readonly priceListSummaryModel: Model<PriceListSummaryDocument>,
  ) {}

  async onModuleInit() {
    await this.priceItemModel.syncIndexes();
    await this.priceListSummaryModel.syncIndexes();
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

    const result = await doc.save();
    await this.recalculateAllSummaries();
    return result;
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
    await this.recalculateAllSummaries();
    return doc;
  }

  async remove(id: string) {
    const doc = await this.priceItemModel.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('Price item not found');
    await this.recalculateAllSummaries();
    return { ok: true };
  }

  private validatePrice(price: number) {
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException('Price must be a valid non-negative number');
    }
  }

  private calculateSummaryFromItems(items: any[], period: SummaryPeriod, referenceDate: string) {
    let totalItems = 0;
    let activeItems = 0;
    let drugs = 0;
    let services = 0;
    let totalValue = 0;

    if (Array.isArray(items)) {
      totalItems = items.length;

      for (const item of items) {
        if (!item) continue;

        if (item.isActive) {
          activeItems++;
          const price = Number(item.price) || 0;
          totalValue += price;
        }

        if (item.category === 'drug') {
          drugs++;
        } else {
          services++;
        }
      }
    }

    return {
      period,
      referenceDate,
      totalItems,
      activeItems,
      drugs,
      totalDrugs: drugs,
      services,
      totalValue,
      totalDrugsInStock: 0,
      totalDrugsSold: 0,
      totalDrugsSoldValue: 0,
    };
  }

  private async recalculateAllSummaries() {
    try {
      const items = await this.priceItemModel.find().lean().exec();
      const currentDate = new Date();
      const currentMonth = currentDate.toISOString().slice(0, 7);
      const currentYear = String(currentDate.getFullYear());

      const monthlySummary = this.calculateSummaryFromItems(items, 'monthly', currentMonth);
      const yearlySummary = this.calculateSummaryFromItems(items, 'yearly', currentYear);

      await this.priceListSummaryModel.findOneAndUpdate(
        { period: 'monthly', referenceDate: currentMonth },
        monthlySummary,
        { upsert: true, new: true }
      );

      await this.priceListSummaryModel.findOneAndUpdate(
        { period: 'yearly', referenceDate: currentYear },
        yearlySummary,
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error('[PriceListService] recalculateAllSummaries error:', error);
    }
  }

  async getSummary(period: SummaryPeriod, referenceDate?: string): Promise<any> {
    const defaultRef = period === 'monthly' 
      ? new Date().toISOString().slice(0, 7) 
      : String(new Date().getFullYear());
    const ref = referenceDate || defaultRef;

    try {
      const existingSummary = await this.priceListSummaryModel.findOne({ period, referenceDate: ref }).lean();

      if (existingSummary) {
        return {
          period: existingSummary.period,
          from: "",
          to: "",
          totalItems: existingSummary.totalItems,
          activeItems: existingSummary.activeItems,
          drugs: existingSummary.drugs,
          totalDrugs: existingSummary.totalDrugs,
          services: existingSummary.services,
          totalValue: existingSummary.totalValue,
          totalDrugsInStock: existingSummary.totalDrugsInStock,
          totalDrugsSold: existingSummary.totalDrugsSold,
          totalDrugsSoldValue: existingSummary.totalDrugsSoldValue,
        };
      }

      const items = await this.priceItemModel.find().lean().exec();
      const calculated = this.calculateSummaryFromItems(items, period, ref);
      const createdSummary = await this.priceListSummaryModel.create(calculated);

      return {
        period: createdSummary.period,
        from: "",
        to: "",
        totalItems: createdSummary.totalItems,
        activeItems: createdSummary.activeItems,
        drugs: createdSummary.drugs,
        totalDrugs: createdSummary.totalDrugs,
        services: createdSummary.services,
        totalValue: createdSummary.totalValue,
        totalDrugsInStock: createdSummary.totalDrugsInStock,
        totalDrugsSold: createdSummary.totalDrugsSold,
        totalDrugsSoldValue: createdSummary.totalDrugsSoldValue,
      };
    } catch (error) {
      console.error('[PriceListService] getSummary error:', error);
      return {
        period,
        from: "",
        to: "",
        totalItems: 0,
        activeItems: 0,
        drugs: 0,
        totalDrugs: 0,
        services: 0,
        totalValue: 0,
        totalDrugsInStock: 0,
        totalDrugsSold: 0,
        totalDrugsSoldValue: 0,
      };
    }
  }

  async getSummaries(referenceDates?: { monthly?: string; yearly?: string }): Promise<Record<SummaryPeriod, any>> {
    const [monthly, yearly] = await Promise.all([
      this.getSummary('monthly', referenceDates?.monthly),
      this.getSummary('yearly', referenceDates?.yearly),
    ]);
    return { monthly, yearly };
  }

  async saveSummary(summaryData: any): Promise<any> {
    const { period, referenceDate, ...rest } = summaryData;
    const filter: any = { period };
    if (referenceDate) {
      filter.referenceDate = referenceDate;
    }
    const summary = await this.priceListSummaryModel.findOneAndUpdate(
      filter,
      { period, referenceDate, ...rest },
      { upsert: true, new: true }
    );
    return summary;
  }
}
