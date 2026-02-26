import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Trust reverse proxy (ngrok in dev, load balancer in prod)
  // so Express reads X-Forwarded-Proto / X-Forwarded-Host correctly
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  // Twilio sends URL-encoded form bodies
  app.use(express.urlencoded({ extended: true }));

  // Global DTO validation
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 WADrive is running on port ${port}`);
}

bootstrap();
