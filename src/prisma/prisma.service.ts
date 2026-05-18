import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    const enabled = String(process.env.PRISMA_ENABLED || '').trim().toLowerCase();
    if (enabled !== 'true' && enabled !== '1' && enabled !== 'yes') return;
    const url = process.env.DATABASE_URL;
    if (!url) return;
    const trimmed = url.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('mongodb://') || trimmed.startsWith('mongodb+srv://')) {
      try {
        const u = new URL(trimmed);
        const pathname = (u.pathname || '').trim();
        if (!pathname || pathname === '/') return;
      } catch {
        return;
      }
    }
    await this.$connect();
  }
}
