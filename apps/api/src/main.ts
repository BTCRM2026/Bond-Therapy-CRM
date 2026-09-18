import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  if (process.env.WEB_ORIGIN) app.enableCors({ origin: process.env.WEB_ORIGIN, credentials: true });
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
await bootstrap();
