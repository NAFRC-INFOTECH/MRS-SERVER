import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Admin, AdminDocument } from '../admin/schemas/admin.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PasswordService } from '../common/security/password';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
    private readonly passwordService: PasswordService,
    private readonly rt: RealtimeGateway
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existsUser = await this.userModel.findOne({ email: dto.email }).lean();
    if (existsUser) throw new ConflictException('Email already registered');
    const existsAdmin = await this.adminModel.findOne({ email: dto.email }).lean();
    if (existsAdmin) throw new ConflictException('Email already registered');
    const passwordHash = await this.passwordService.hash(dto.password);
    const user = new this.userModel({
      email: dto.email,
      name: dto.name,
      passwordHash
    });
    const saved = await user.save();
    this.rt.emit('user.updated', { id: saved.id });
    return saved;
  }

  async anyUserExists(): Promise<boolean> {
    const doc = await this.userModel.findOne({}, { _id: 1 }).lean();
    return !!doc;
  }

  async superAdminExists(): Promise<boolean> {
    const doc = await this.userModel.findOne({ roles: 'super_admin' }, { _id: 1 }).lean();
    return !!doc;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email });
  }

  async findByRole(role: string): Promise<UserDocument[]> {
    return this.userModel.find({ roles: role }).lean();
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find({}).lean();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(id, dto, { new: true });
    if (!user) throw new NotFoundException('User not found');
    this.rt.emit('user.updated', { id: user.id });
    return user;
  }

  async assignRoles(id: string, roles: string[]): Promise<UserDocument> {
    const sanitized = roles.filter((r) => r !== 'doctor');
    const user = await this.userModel.findByIdAndUpdate(id, { roles: sanitized }, { new: true });
    if (!user) throw new NotFoundException('User not found');
    this.rt.emit('user.updated', { id: user.id, roles });
    return user;
  }

  async validatePassword(user: UserDocument, plain: string): Promise<boolean> {
    return this.passwordService.verify(plain, user.passwordHash);
  }

  async suspend(id: string, suspended: boolean): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(id, { suspended }, { new: true });
    if (!user) throw new NotFoundException('User not found');
    this.rt.emit('user.updated', { id: user.id, suspended });
    return user;
  }

  async remove(id: string): Promise<void> {
    const res = await this.userModel.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('User not found');
    this.rt.emit('user.deleted', { id });
  }

  async setRefreshToken(userId: string, tokenHash: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash: tokenHash });
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: '' } });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const ok = await this.passwordService.verify(currentPassword, user.passwordHash);
    if (!ok) throw new NotFoundException('Invalid current password');
    const hash = await this.passwordService.hash(newPassword);
    user.passwordHash = hash;
    user.passwordVersion = (user.passwordVersion ?? 1) + 1;
    user.refreshTokenHash = undefined;
    await user.save();
  }
}
