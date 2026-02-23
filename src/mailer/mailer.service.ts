import { Injectable } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailerService {
  private transporter: Transporter | null = null;
  private from: string;
  private appName: string;
  private frontendUrl: string;
  private readonly env: string;

  constructor(private readonly config: ConfigService, private readonly logger: Logger) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT');
    const secure = this.config.get<boolean>('SMTP_SECURE');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.from = this.config.get<string>('MAIL_FROM') || 'no-reply@mrs.local';
    this.appName = this.config.get<string>('APP_NAME') || 'MRS';
    this.frontendUrl = (this.config.get<string>('FRONTEND_URL') || '').replace(/\/$/, '');
    this.env = this.config.get<string>('NODE_ENV') || 'development';

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: !!secure,
        auth: { user, pass }
      });
      this.logger.debug('SMTP transporter initialized');
    } else if (this.env !== 'production') {
      nodemailer.createTestAccount().then((testAccount) => {
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
        this.from = this.from || testAccount.user;
        this.logger.debug('Ethereal test transporter initialized');
      }).catch(() => {
        this.logger.warn('Unable to initialize Ethereal test transporter');
      });
    }
  }

  async sendDoctorInvitation(email: string, token: string) {
    const acceptUrl =
      this.frontendUrl
        ? `${this.frontendUrl}/invite/accept?token=${encodeURIComponent(token)}`
        : `${this.config.get<string>('PUBLIC_API_URL') || ''}/api/v1/invitations/${encodeURIComponent(token)}`;
    const subject = `You're invited to ${this.appName} as a Doctor`;
    const html = this.invitationTemplate({ appName: this.appName, acceptUrl });
    await this.dispatch(email, subject, html);
  }

  async sendDoctorWelcome(email: string, name?: string) {
    const subject = `Welcome to ${this.appName}`;
    const landing = this.frontendUrl || this.config.get<string>('PUBLIC_APP_URL') || '';
    const html = this.welcomeTemplate({ appName: this.appName, name, landing });
    await this.dispatch(email, subject, html);
  }

  private async dispatch(to: string, subject: string, html: string) {
    try {
      if (this.transporter) {
        const info = await this.transporter.sendMail({ from: this.from, to, subject, html });
        const preview = nodemailer.getTestMessageUrl(info);
        if (preview) this.logger.debug({ preview }, 'Mail preview URL');
      } else {
        this.logger.warn({ to, subject }, 'Mailer not configured; fallback log only');
      }
    } catch {
      this.logger.error({ to, subject }, 'Mailer send error');
    }
  }

  private invitationTemplate(params: { appName: string; acceptUrl: string }) {
    const { appName, acceptUrl } = params;
    return `
    <div style="font-family: Inter, Arial, sans-serif; background:#f7fafc; padding:24px">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="padding:24px">
          <h2 style="margin:0 0 12px 0;font-size:20px;color:#111827">${appName} Invitation</h2>
          <p style="margin:0 0 16px 0;color:#374151;font-size:14px">
            You have been invited to join ${appName} as a Doctor. Click the button below to accept the invitation and set your password.
          </p>
          <p style="text-align:center;margin:24px 0">
            <a href="${acceptUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Accept Invitation</a>
          </p>
          <p style="margin:0;color:#6b7280;font-size:12px">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <span style="word-break:break-all">${acceptUrl}</span>
          </p>
        </td></tr>
      </table>
    </div>
    `;
  }

  private welcomeTemplate(params: { appName: string; name?: string; landing: string }) {
    const { appName, name, landing } = params;
    const greeting = name ? `Hi ${name},` : 'Hi,';
    const cta = landing ? `<p style="text-align:center;margin:24px 0">
      <a href="${landing}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Go to ${appName}</a>
    </p>` : '';
    return `
    <div style="font-family: Inter, Arial, sans-serif; background:#f7fafc; padding:24px">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr>
          <td style="padding:24px">
            <h2 style="margin:0 0 12px 0;font-size:20px;color:#111827">Welcome to ${appName}</h2>
            <p style="margin:0 0 16px 0;color:#374151;font-size:14px">${greeting}</p>
            <p style="margin:0 0 16px 0;color:#374151;font-size:14px">
              Your account has been created. You can now sign in using your email and password.
            </p>
            ${cta}
          </td>
        </tr>
      </table>
    </div>
    `;
  }
}
