import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DoctorProfile, DoctorProfileDocument } from './doctor-profile.schema';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PasswordService } from '../common/security/password';
import { randomBytes } from 'crypto';

@Injectable()
export class DoctorProfileService {
  constructor(
    @InjectModel(DoctorProfile.name) private readonly profileModel: Model<DoctorProfileDocument>,
    private readonly rt: RealtimeGateway,
    private readonly passwordService: PasswordService
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

  async findByEmail(email: string): Promise<DoctorProfileDocument | null> {
    const e = (email || '').trim().toLowerCase();
    return this.profileModel.findOne({ 'personalInfo.email': e });
  }

  async createWithAuth(name: string, email: string, password: string): Promise<DoctorProfileDocument> {
    const userId = randomBytes(12).toString('hex');
    const hash = await this.passwordService.hash(password);
    const profile = new this.profileModel({
      userId,
      passwordHash: hash,
      passwordVersion: 1,
      personalInfo: {
        id: userId,
        fullName: name ?? '',
        email: (email || '').trim().toLowerCase(),
        status: 'pending'
      }
    });
    const saved = await profile.save();
    this.rt.emit('profile.updated', { userId });
    return saved;
  }

  async validatePassword(profile: DoctorProfileDocument, plain: string): Promise<boolean> {
    if (!profile.passwordHash) return false;
    return this.passwordService.verify(plain, profile.passwordHash);
  }

  async setRefreshToken(userId: string, tokenHash: string): Promise<void> {
    await this.profileModel.findOneAndUpdate({ userId }, { refreshTokenHash: tokenHash });
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.profileModel.findOneAndUpdate({ userId }, { $unset: { refreshTokenHash: '' } });
  }

  async resetPassword(userId: string): Promise<{ password: string }> {
    const pass = this.generateRandomPassword();
    const hash = await this.passwordService.hash(pass);
    const updated = await this.profileModel.findOneAndUpdate(
      { userId },
      { passwordHash: hash, $inc: { passwordVersion: 1 } },
      { new: true }
    );
    if (!updated) throw new NotFoundException('Profile not found');
    return { password: pass };
  }

  private generateRandomPassword(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&';
    const len = 14;
    let out = '';
    for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
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
    this.rt.emit('profile.updated', { userId });
    return profile;
  }

  async updateStatus(userId: string, status: string): Promise<DoctorProfileDocument> {
    const profile = await this.profileModel.findOneAndUpdate(
      { userId },
      { 'personalInfo.status': status },
      { new: true }
    );
    if (!profile) throw new NotFoundException('Profile not found');
    this.rt.emit('profile.updated', { userId, status });
    return profile;
  }

  async deleteByUserId(userId: string): Promise<{ ok: true }> {
    const res = await this.profileModel.findOneAndDelete({ userId });
    if (!res) throw new NotFoundException('Profile not found');
    this.rt.emit('profile.deleted', { userId });
    return { ok: true };
  }
}
