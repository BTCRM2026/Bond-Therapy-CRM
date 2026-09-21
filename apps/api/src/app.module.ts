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
import { ClientsModule } from './clients/clients.module.js';
import { LeadsModule } from './leads/leads.module.js';
import { ProductsModule } from './products/products.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { SalesModule } from './sales/sales.module.js';
import { WarehouseModule } from './warehouse/warehouse.module.js';

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
    ClientsModule,
    LeadsModule,
    ProductsModule,
    OrdersModule,
    SalesModule,
    WarehouseModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
