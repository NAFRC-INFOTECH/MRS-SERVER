import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PasswordService } from '../common/security/password';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Admin, AdminDocument } from './schemas/admin.schema';
import { UpdateUserDto } from '../users/dto/update-user.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly passwordService: PasswordService
  ) {}

  async create(dto: { name: string; email: string; password: string }): Promise<AdminDocument> {
    const existsAdmin = await this.adminModel.findOne({ email: dto.email }).lean();
    if (existsAdmin) throw new ConflictException('Email already registered');
    const existsUser = await this.userModel.findOne({ email: dto.email }).lean();
    if (existsUser) throw new ConflictException('Email already registered');
    const passwordHash = await this.passwordService.hash(dto.password);
    const admin = new this.adminModel({
      email: dto.email,
      name: dto.name,
      passwordHash,
      roles: ['super_admin']
    });
    return admin.save();
  }

  async adminExists(): Promise<boolean> {
    const doc = await this.adminModel.findOne({}, { _id: 1 }).lean();
    return !!doc;
  }

  async findByEmail(email: string): Promise<AdminDocument | null> {
    return this.adminModel.findOne({ email });
  }

  async findById(id: string): Promise<AdminDocument | null> {
    return this.adminModel.findById(id);
  }

  async validatePassword(admin: AdminDocument, plain: string): Promise<boolean> {
    return this.passwordService.verify(plain, admin.passwordHash);
  }

  async setRefreshToken(adminId: string, tokenHash: string): Promise<void> {
    await this.adminModel.findByIdAndUpdate(adminId, { refreshTokenHash: tokenHash });
  }

  async clearRefreshToken(adminId: string): Promise<void> {
    await this.adminModel.findByIdAndUpdate(adminId, { $unset: { refreshTokenHash: '' } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<AdminDocument> {
    const admin = await this.adminModel.findByIdAndUpdate(id, dto, { new: true });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string): Promise<void> {
    const admin = await this.adminModel.findById(adminId);
    if (!admin) throw new NotFoundException('Admin not found');
    const ok = await this.passwordService.verify(currentPassword, admin.passwordHash);
    if (!ok) throw new NotFoundException('Invalid current password');
    const hash = await this.passwordService.hash(newPassword);
    admin.passwordHash = hash;
    admin.passwordVersion = (admin.passwordVersion ?? 1) + 1;
    admin.refreshTokenHash = undefined;
    await admin.save();
  }
}
