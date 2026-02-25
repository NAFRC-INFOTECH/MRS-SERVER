import { Injectable } from '@nestjs/common';
import { MailerService as NestMailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppMailerService {
  private readonly from: string;
  private readonly appName: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly mailer: NestMailerService,
    private readonly config: ConfigService
  ) {
    this.from = this.config.get<string>('MAIL_FROM') || this.config.get<string>('EMAIL_FROM') || 'no-reply@mrs.local';
    this.appName = this.config.get<string>('APP_NAME') || 'MRS';
    this.frontendUrl = (this.config.get<string>('FRONTEND_URL') || '').replace(/\/$/, '');
  }

  async sendDoctorInvitation(email: string, token: string): Promise<{ ok: boolean; error?: string }> {
    const acceptUrl =
      this.frontendUrl
        ? `${this.frontendUrl}/invite/accept?token=${encodeURIComponent(token)}`
        : `${this.config.get<string>('PUBLIC_API_URL') || ''}/api/v1/invitations/${encodeURIComponent(token)}`;
    try {
      await this.mailer.sendMail({
        to: email,
        from: this.from,
        subject: `You're invited to ${this.appName} as a Doctor`,
        template: './invitation',
        context: { appName: this.appName, acceptUrl }
      });
      return { ok: true };
    } catch (e) {
      const message = (e as Error)?.message || 'SMTP send failed';
      return { ok: false, error: message };
    }
  }

  async sendDoctorWelcome(email: string, name?: string): Promise<{ ok: boolean; error?: string }> {
    const landing = this.frontendUrl || this.config.get<string>('PUBLIC_APP_URL') || '';
    try {
      await this.mailer.sendMail({
        to: email,
        from: this.from,
        subject: `Welcome to ${this.appName}`,
        template: './welcome',
        context: { appName: this.appName, name, landing }
      });
      return { ok: true };
    } catch (e) {
      const message = (e as Error)?.message || 'SMTP send failed';
      return { ok: false, error: message };
    }
  }
}
