import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PasswordService } from '../common/security/password';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly passwordService: PasswordService
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const exists = await this.userModel.findOne({ email: dto.email }).lean();
    if (exists) throw new ConflictException('Email already registered');
    const passwordHash = await this.passwordService.hash(dto.password);
    const user = new this.userModel({
      email: dto.email,
      name: dto.name,
      passwordHash
    });
    return user.save();
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

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(id, dto, { new: true });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async assignRoles(id: string, roles: string[]): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(id, { roles }, { new: true });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async validatePassword(user: UserDocument, plain: string): Promise<boolean> {
    return this.passwordService.verify(plain, user.passwordHash);
  }

  async setRefreshToken(userId: string, tokenHash: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash: tokenHash });
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: '' } });
  }
}
