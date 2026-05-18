import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  @Get()
  async getHealth() {
    const mongoUri = String(process.env.MONGO_URI || '').trim();
    const useInMemoryRaw = String(process.env.USE_INMEMORY_MONGO || '').trim().toLowerCase();
    const useInMemory = useInMemoryRaw === 'true' || useInMemoryRaw === '1' || useInMemoryRaw === 'yes' || useInMemoryRaw === '';
    const usingInMemory = !mongoUri && useInMemory;
    return {
      ok: true,
      mongo: {
        readyState: this.conn.readyState,
        usingInMemory
      }
    };
  }
}

