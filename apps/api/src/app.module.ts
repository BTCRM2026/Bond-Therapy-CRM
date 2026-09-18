import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppController],
})
export class AppModule {}
