import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { RolesModule } from './roles/roles.module.js';
import { DistributorsModule } from './distributors/distributors.module.js';
import { AgreementsModule } from './agreements/agreements.module.js';
import { AuditLogModule } from './audit-log/audit-log.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    DistributorsModule,
    AgreementsModule,
    AuditLogModule,
    NotificationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
