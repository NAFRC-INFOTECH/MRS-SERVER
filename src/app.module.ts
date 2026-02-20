import { Module } from '@nestjs/common';
import * as Joi from 'joi';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AdminModule } from './admin/admin.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { InvitationsModule } from './invitations/invitations.module';
import { DoctorProfileModule } from './doctor-profile/doctor-profile.module';
// import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(8000),
        CORS_ORIGIN: Joi.string().optional(),
        MONGO_URI: Joi.string().when('NODE_ENV', {
          is: 'production',
          then: Joi.string().required(),
          otherwise: Joi.string().optional()
        }),
        USE_INMEMORY_MONGO: Joi.boolean().default(true),
        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        PEPPER_SECRET: Joi.string().required(),
        RATE_LIMIT_TTL: Joi.number().default(60),
        RATE_LIMIT_LIMIT: Joi.number().default(100)
      })
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
      }
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => {
        let uri = config.get<string>('MONGO_URI');
        const useMemory =
          config.get<string>('NODE_ENV') !== 'production' &&
          config.get<boolean>('USE_INMEMORY_MONGO');
        if ((!uri || uri.length === 0) && useMemory) {
          const mongod = await MongoMemoryServer.create();
          uri = mongod.getUri();
        }
        return {
          uri,
          autoIndex: config.get<string>('NODE_ENV') !== 'production'
        };
      },
      inject: [ConfigService]
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        ttl: config.get<number>('RATE_LIMIT_TTL'),
        limit: config.get<number>('RATE_LIMIT_LIMIT')
      }),
      inject: [ConfigService]
    }),
    UsersModule,
    AdminModule,
    AuthModule,
    ProfileModule,
    PrismaModule,
    InvitationsModule,
    DoctorProfileModule
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    }
    ,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
