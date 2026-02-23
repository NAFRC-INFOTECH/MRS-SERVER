import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invitation, InvitationDocument, generateInvitationToken } from './invitations.schema';
import { MailerService } from '../mailer/mailer.service';
import { UsersService } from '../users/users.service';
import { DoctorProfileService } from '../doctor-profile/doctor-profile.service';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectModel(Invitation.name) private readonly invitationModel: Model<InvitationDocument>,
    private readonly mailer: MailerService,
    private readonly usersService: UsersService,
    private readonly doctorProfileService: DoctorProfileService
  ) {}

  async inviteDoctor(email: string, invitedBy?: string): Promise<InvitationDocument> {
    const existingPending = await this.invitationModel.findOne({ email, role: 'doctor', status: 'pending' });
    if (existingPending) {
      await this.mailer.sendDoctorInvitation(email, existingPending.token);
      return existingPending;
    }
    const token = generateInvitationToken();
    const inv = new this.invitationModel({ email, role: 'doctor', token, status: 'pending', invitedBy });
    const saved = await inv.save();
    await this.mailer.sendDoctorInvitation(email, token);
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
