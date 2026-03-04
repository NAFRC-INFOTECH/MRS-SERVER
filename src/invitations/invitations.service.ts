import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invitation, InvitationDocument, generateInvitationToken } from './invitations.schema';
import { AppMailerService } from '../mailer/app-mailer.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import { DoctorProfileService } from '../doctor-profile/doctor-profile.service';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    @InjectModel(Invitation.name) private readonly invitationModel: Model<InvitationDocument>,
    private readonly mailer: AppMailerService,
    private readonly usersService: UsersService,
    private readonly doctorProfileService: DoctorProfileService,
    private readonly rt: RealtimeGateway
  ) { }

  async inviteDoctor(email: string, invitedBy?: string): Promise<InvitationDocument> {
    // Check for existing pending invitation — resend if found
    const existingPending = await this.invitationModel.findOne({ email, role: 'doctor', status: 'pending' });
    if (existingPending) {
      this.logger.log(`Resending invitation to existing pending invite for ${email}`);
      const res = await this.mailer.sendInvitation(email, existingPending.token, 'Doctor');
      if (!res.ok) throw new ServiceUnavailableException(res.error || 'Failed to send invitation email');
      this.rt.emitToRole('super_admin', 'invitation.resend', { email, role: 'doctor' });
      return existingPending;
    }

    // Create new invitation record first
    const token = generateInvitationToken();
    const res = await this.mailer.sendInvitation(email, token, 'Doctor');
    if (!res.ok) throw new ServiceUnavailableException(res.error || 'Failed to send invitation email');
    const inv = new this.invitationModel({ email, role: 'doctor', token, status: 'pending', invitedBy });
    const saved = await inv.save();
    this.logger.log(`Invitation record created for ${email} (token: ${token.slice(0, 8)}...)`);
    this.rt.emitToRole('super_admin', 'invitation.created', { email, role: 'doctor' });

    return saved;
  }

  async inviteNurse(email: string, invitedBy?: string): Promise<InvitationDocument> {
    const existingPending = await this.invitationModel.findOne({ email, role: 'nurse', status: 'pending' });
    if (existingPending) {
      this.logger.log(`Resending invitation to existing pending nurse invite for ${email}`);
      const res = await this.mailer.sendInvitation(email, existingPending.token, 'Nurse');
      if (!res.ok) throw new ServiceUnavailableException(res.error || 'Failed to send invitation email');
      this.rt.emitToRole('super_admin', 'invitation.resend', { email, role: 'nurse' });
      return existingPending;
    }
    const token = generateInvitationToken();
    const res = await this.mailer.sendInvitation(email, token, 'Nurse');
    if (!res.ok) throw new ServiceUnavailableException(res.error || 'Failed to send invitation email');
    const inv = new this.invitationModel({ email, role: 'nurse', token, status: 'pending', invitedBy });
    const saved = await inv.save();
    this.logger.log(`Nurse invitation record created for ${email} (token: ${token.slice(0, 8)}...)`);
    this.rt.emitToRole('super_admin', 'invitation.created', { email, role: 'nurse' });
    return saved;
  }

  async findByToken(token: string): Promise<InvitationDocument | null> {
    return this.invitationModel.findOne({ token });
  }

  async findPendingByEmail(email: string): Promise<InvitationDocument | null> {
    return this.invitationModel.findOne({ email, role: 'doctor', status: 'pending' });
  }

  async createDoctorDirect(name: string, email: string) {
    const password = this.generateRandomPassword();
    const user = await this.usersService.create({ name, email, password } as any);
    await this.usersService.assignRoles(user.id, [...(user.roles || []), 'doctor']);
    return { id: user.id, email: user.email, name: user.name, password };
  }

  async createNurseDirect(name: string, email: string, department?: string) {
    const password = this.generateRandomPassword();
    const user = await this.usersService.create({ name, email, password, department });
    await this.usersService.assignRoles(user.id, ['nurse']);
    return { id: user.id, email: user.email, name: user.name, password };
  }

  async createRecordingDirect(name: string, email: string) {
    const password = this.generateRandomPassword();
    const user = await this.usersService.create({ name, email, password } as any);
    await this.usersService.assignRoles(user.id, ['recording']);
    return { id: user.id, email: user.email, name: user.name, password };
  }

  private generateRandomPassword(): string {
    // 12+ chars, mixed alphanumerics
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&';
    const len = 14;
    let out = '';
    for (let i = 0; i < len; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  }

  async markAcceptedByEmail(email: string): Promise<void> {
    const inv = await this.invitationModel.findOne({ email, role: 'doctor', status: 'pending' });
    if (!inv) throw new NotFoundException('Invitation not found');
    inv.status = 'accepted';
    inv.acceptedAt = new Date();
    await inv.save();
  }

  async acceptByToken(token: string, email: string, password: string, name?: string) {
    const inv = await this.invitationModel.findOne({ token, status: 'pending' });
    if (!inv) throw new NotFoundException('Invitation not found or already processed');
    if (inv.email.toLowerCase() !== email.toLowerCase()) {
      throw new BadRequestException('Email does not match this invitation');
    }
    const role = inv.role || 'doctor';
    const patch: any = { name: name || inv.email.split('@')[0], email: inv.email, password };
    if (role === 'nurse') patch.department = 'GOPD';
    const user = await this.usersService.create(patch);
    await this.usersService.assignRoles(user.id, [...(user.roles || []), role]);
    inv.status = 'accepted';
    inv.acceptedAt = new Date();
    await inv.save();
    if (role === 'doctor') await this.mailer.sendDoctorWelcome(user.email, user.name);
    this.rt.emitToRole('super_admin', 'invitation.accepted', { email: user.email, role });
    return { ok: true };
  }
}
