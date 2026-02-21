import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(compression());
  app.use(mongoSanitize());
  const configService = app.get(ConfigService);
  const corsOriginRaw = configService.get<string>('CORS_ORIGIN');
  const corsOrigin = corsOriginRaw ? corsOriginRaw.replace(/\/$/, '') : true;
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1'
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  const port = parseInt(process.env.PORT ?? '8000', 10);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MRS API')
    .setDescription('Medical Records System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
  });

  await app.listen(port);
}

bootstrap();
