import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AdminService } from '../admin/admin.service';
import { ConfigService } from '@nestjs/config';
import { PasswordService } from '../common/security/password';
import { RegisterDto } from './dto/register.dto';
import { InvitationsService } from '../invitations/invitations.service';
import { DoctorProfileService } from '../doctor-profile/doctor-profile.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly adminService: AdminService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly invitationsService: InvitationsService,
    private readonly doctorProfileService: DoctorProfileService
  ) {}

  async register(dto: RegisterDto) {
    const hasAdmin = await this.adminService.adminExists();
    // If no admin exists, first registration becomes super admin
    if (!hasAdmin) {
      const admin = await this.adminService.create(dto);
      const adminObj = admin.toObject();
      const safeAdmin: Record<string, unknown> = { ...adminObj };
      delete (safeAdmin as Record<string, unknown>)['passwordHash'];
      delete (safeAdmin as Record<string, unknown>)['refreshTokenHash'];
      return safeAdmin;
    }
    // If there is a pending doctor invitation for this email, create user and skeleton profile, then mark invitation accepted
    const invitation = await this.invitationsService.findPendingByEmail(dto.email);
    const doc = await this.usersService.create(dto);
    if (invitation) {
      await this.invitationsService.markAcceptedByEmail(dto.email);
      await this.doctorProfileService.createSkeleton(doc.id, doc.email, doc.name);
    }
    const userObj = doc.toObject();
    const safeUser: Record<string, unknown> = { ...userObj };
    delete (safeUser as Record<string, unknown>)['passwordHash'];
    delete (safeUser as Record<string, unknown>)['refreshTokenHash'];
    return safeUser;
  }

  async validateUser(email: string, password: string) {
    const admin = await this.adminService.findByEmail(email);
    if (admin) {
      const ok = await this.adminService.validatePassword(admin, password);
      if (!ok) throw new UnauthorizedException('Invalid credentials');
      return { doc: admin, isAdmin: true };
    }
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await this.usersService.validatePassword(user, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return { doc: user, isAdmin: false };
  }

  async login(email: string, password: string) {
    const { doc, isAdmin } = await this.validateUser(email, password);
    const tokens = await this.issueTokens(doc.id, doc.email, doc.roles, doc.passwordVersion);
    const refreshTokenHash = await this.passwordService.hash(tokens.refreshToken);
    if (isAdmin) await this.adminService.setRefreshToken(doc.id, refreshTokenHash);
    else await this.usersService.setRefreshToken(doc.id, refreshTokenHash);
    return tokens;
  }

  async refresh(userId: string, providedToken: string) {
    const admin = await this.adminService.findById(userId);
    if (admin && admin.refreshTokenHash) {
      const ok = await this.passwordService.verify(providedToken, admin.refreshTokenHash);
      if (!ok) throw new UnauthorizedException('Invalid token');
      const tokens = await this.issueTokens(admin.id, admin.email, admin.roles, admin.passwordVersion);
      const refreshTokenHash = await this.passwordService.hash(tokens.refreshToken);
      await this.adminService.setRefreshToken(admin.id, refreshTokenHash);
      return tokens;
    }
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshTokenHash) throw new UnauthorizedException('Invalid token');
    const ok = await this.passwordService.verify(providedToken, user.refreshTokenHash);
    if (!ok) throw new UnauthorizedException('Invalid token');
    const tokens = await this.issueTokens(user.id, user.email, user.roles, user.passwordVersion);
    const refreshTokenHash = await this.passwordService.hash(tokens.refreshToken);
    await this.usersService.setRefreshToken(user.id, refreshTokenHash);
    return tokens;
  }

  async logout(userId: string) {
    const admin = await this.adminService.findById(userId);
    if (admin) {
      await this.adminService.clearRefreshToken(userId);
    } else {
      await this.usersService.clearRefreshToken(userId);
    }
    return { ok: true };
  }

  private async issueTokens(sub: string, email: string, roles: string[], pv: number) {
    const payload = { sub, email, roles, pv };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m'
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d'
    });
    return { accessToken, refreshToken };
  }
}
