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
    const unique = Array.from(new Set(roles));
    const user = await this.userModel.findByIdAndUpdate(id, { roles: unique }, { new: true });
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

  async updateDoctorStatus(userId: string, status: string): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(userId, { 'doctor.status': status }, { new: true });
    if (!user) throw new NotFoundException('User not found');
    this.rt.emit('user.updated', { id: user.id, status });
    return user;
  }

  async resetPassword(userId: string): Promise<{ password: string }> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&';
    const len = 14;
    let out = '';
    for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const hash = await this.passwordService.hash(out);
    user.passwordHash = hash;
    user.passwordVersion = (user.passwordVersion ?? 1) + 1;
    user.refreshTokenHash = undefined;
    await user.save();
    return { password: out };
  }

  async upsertFromDoctorProfile(profile: any): Promise<UserDocument> {
    const email = (profile?.personalInfo?.email || '').trim().toLowerCase();
    if (!email) throw new NotFoundException('Doctor email missing');
    let user = await this.userModel.findOne({ email });
    const base: Partial<User> = {
      email,
      name: profile?.personalInfo?.fullName || '',
      imageUrl: profile?.personalInfo?.imageUrl || '',
      phone: profile?.personalInfo?.phone || '',
      address: profile?.personalInfo?.address || '',
      country: profile?.personalInfo?.nationality || '',
      state: profile?.personalInfo?.state || '',
      emergencyPhone: profile?.personalInfo?.emergencyContact || '',
    } as any;
    const doctorMeta: any = {
      status: profile?.personalInfo?.status || 'pending',
      hospital: profile?.personalInfo?.hospital || '',
      qualifications: {
        medicalDegree: profile?.qualifications?.medicalDegree || '',
        specialization: profile?.qualifications?.specialization || '',
        licenses: profile?.qualifications?.licenses || '',
        boardCertifications: profile?.qualifications?.boardCertifications || '',
        additionalCertifications: profile?.qualifications?.additionalCertifications || '',
        medicalSchool: profile?.qualifications?.medicalSchool || '',
        graduationYear: profile?.qualifications?.graduationYear || '',
      },
    };
    if (user) {
      user.name = base.name!;
      user.imageUrl = base.imageUrl;
      user.phone = base.phone;
      user.address = base.address;
      user.country = base.country;
      user.state = base.state;
      user.emergencyPhone = base.emergencyPhone;
      const roles = new Set(user.roles || []);
      roles.add('doctor');
      user.roles = Array.from(roles);
      (user as any).doctor = doctorMeta;
      if (profile?.passwordHash) {
        user.passwordHash = profile.passwordHash;
        user.passwordVersion = profile.passwordVersion ?? user.passwordVersion ?? 1;
      }
      if (profile?.refreshTokenHash) {
        user.refreshTokenHash = profile.refreshTokenHash;
      }
      await user.save();
      this.rt.emit('user.updated', { id: user.id });
      return user;
    }
    // create new user
    user = new this.userModel({
      ...base,
      roles: ['doctor'],
      passwordHash: profile?.passwordHash ?? (await this.passwordService.hash('TempPass#12345')),
      passwordVersion: profile?.passwordVersion ?? 1,
      refreshTokenHash: profile?.refreshTokenHash,
      doctor: doctorMeta,
    });
    const saved = await user.save();
    this.rt.emit('user.updated', { id: saved.id });
    return saved;
  }
}
