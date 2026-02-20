import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DoctorProfile, DoctorProfileDocument } from './doctor-profile.schema';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
import { UsersService } from '../users/users.service';

@Injectable()
export class DoctorProfileService {
  constructor(
    @InjectModel(DoctorProfile.name) private readonly profileModel: Model<DoctorProfileDocument>,
    private readonly usersService: UsersService
  ) {}

  async createSkeleton(userId: string, email: string, name?: string): Promise<DoctorProfileDocument> {
    const existing = await this.profileModel.findOne({ userId }).lean();
    if (existing) {
      const doc = await this.profileModel.findOne({ userId });
      if (!doc) throw new NotFoundException('Profile not found');
      return doc;
    }
    const profile = new this.profileModel({
      userId,
      personalInfo: {
        id: userId,
        fullName: name ?? '',
        email,
        status: 'pending'
      }
    });
    return profile.save();
  }

  async listAll(): Promise<DoctorProfileDocument[]> {
    return this.profileModel.find({});
  }

  async findByUserId(userId: string): Promise<DoctorProfileDocument> {
    const profile = await this.profileModel.findOne({ userId });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async updateForUser(userId: string, patch: DeepPartial<DoctorProfile>): Promise<DoctorProfileDocument> {
    const profile = await this.profileModel.findOneAndUpdate({ userId }, patch, { new: true });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async completeOnboarding(userId: string): Promise<DoctorProfileDocument> {
    const profile = await this.profileModel.findOneAndUpdate(
      { userId },
      { 'personalInfo.status': 'active' },
      { new: true }
    );
    if (!profile) throw new NotFoundException('Profile not found');
    const user = await this.usersService.findById(userId);
    if (user) {
      const current = Array.isArray(user.roles) ? user.roles : [];
      const roles = current.includes('doctor') ? current : [...current, 'doctor'];
      await this.usersService.assignRoles(userId, roles);
    }
    return profile;
  }
}
