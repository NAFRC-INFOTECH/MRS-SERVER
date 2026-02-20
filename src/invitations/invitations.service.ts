import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invitation, InvitationDocument, generateInvitationToken } from './invitations.schema';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectModel(Invitation.name) private readonly invitationModel: Model<InvitationDocument>
  ) {}

  async inviteDoctor(email: string, invitedBy?: string): Promise<InvitationDocument> {
    const existingPending = await this.invitationModel.findOne({ email, role: 'doctor', status: 'pending' }).lean();
    if (existingPending) throw new ConflictException('An active invitation already exists for this email');
    const token = generateInvitationToken();
    const inv = new this.invitationModel({ email, role: 'doctor', token, status: 'pending', invitedBy });
    return inv.save();
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
}
