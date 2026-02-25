import { Global, Module } from '@nestjs/common';
import { MailerModule as NestMailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import * as fs from 'fs';
import { AppMailerService } from './app-mailer.service';

@Global()
@Module({
  imports: [
    NestMailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => {
        const host = config.get<string>('SMTP_HOST');
        const port = Number(config.get<string>('SMTP_PORT'));
        const secure = String(config.get<string>('SMTP_SECURE')) === 'true';
        const user = config.get<string>('SMTP_USER');
        const pass = (config.get<string>('SMTP_PASS') || '').replace(/\s+/g, '');
        const from = config.get<string>('MAIL_FROM') || config.get<string>('EMAIL_FROM') || 'no-reply@mrs.local';
        const distDir = join(process.cwd(), 'dist', 'mailer', 'templates');
        const srcDir = join(process.cwd(), 'src', 'mailer', 'templates');
        const templateDir = fs.existsSync(distDir) ? distDir : srcDir;
        return {
          transport: { host, port, secure, auth: { user, pass } },
          defaults: { from },
          template: {
            dir: templateDir,
            adapter: new HandlebarsAdapter(),
            options: { strict: true }
          }
        };
      },
      inject: [ConfigService]
    })
  ],
  providers: [AppMailerService],
  exports: [AppMailerService]
})
export class MailerModule {}
