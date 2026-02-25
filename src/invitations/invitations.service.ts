import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invitation, InvitationDocument, generateInvitationToken } from './invitations.schema';
import { AppMailerService } from '../mailer/app-mailer.service';
import { UsersService } from '../users/users.service';
import { DoctorProfileService } from '../doctor-profile/doctor-profile.service';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    @InjectModel(Invitation.name) private readonly invitationModel: Model<InvitationDocument>,
    private readonly mailer: AppMailerService,
    private readonly usersService: UsersService,
    private readonly doctorProfileService: DoctorProfileService
  ) { }

  async inviteDoctor(email: string, invitedBy?: string): Promise<InvitationDocument> {
    // Check for existing pending invitation — resend if found
    const existingPending = await this.invitationModel.findOne({ email, role: 'doctor', status: 'pending' });
    if (existingPending) {
      this.logger.log(`Resending invitation to existing pending invite for ${email}`);
      const res = await this.mailer.sendDoctorInvitation(email, existingPending.token);
      if (!res.ok) throw new ServiceUnavailableException(res.error || 'Failed to send invitation email');
      return existingPending;
    }

    // Create new invitation record first
    const token = generateInvitationToken();
    const res = await this.mailer.sendDoctorInvitation(email, token);
    if (!res.ok) throw new ServiceUnavailableException(res.error || 'Failed to send invitation email');
    const inv = new this.invitationModel({ email, role: 'doctor', token, status: 'pending', invitedBy });
    const saved = await inv.save();
    this.logger.log(`Invitation record created for ${email} (token: ${token.slice(0, 8)}...)`);

    return saved;
  }

  async findByToken(token: string): Promise<InvitationDocument | null> {
    return this.invitationModel.findOne({ token });
  }

  async findPendingByEmail(email: string): Promise<InvitationDocument | null> {
    return this.invitationModel.findOne({ email, role: 'doctor', status: 'pending' });
  }

  async markAcceptedByEmail(email: string): Promise<void> {
    const inv = await this.invitationModel.findOne({ email, role: 'doctor', status: 'pending' });
    if (!inv) throw new NotFoundException('Invitation not found');
    inv.status = 'accepted';
    inv.acceptedAt = new Date();
    await inv.save();
  }

  async acceptByToken(token: string, password: string, name?: string) {
    const inv = await this.invitationModel.findOne({ token, status: 'pending' });
    if (!inv) throw new NotFoundException('Invitation not found or already processed');
    const user = await this.usersService.create({ email: inv.email, password, name: name || inv.email.split('@')[0] });
    inv.status = 'accepted';
    inv.acceptedAt = new Date();
    await inv.save();
    await this.doctorProfileService.createSkeleton(user.id, user.email, user.name);
    await this.usersService.assignRoles(user.id, ['doctor']);
    await this.mailer.sendDoctorWelcome(user.email, user.name);
    return { ok: true };
  }
}
