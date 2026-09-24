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
import { IncentivesModule } from './incentives/incentives.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { BillingModule } from './billing/billing.module.js';
import { TerritoryModule } from './territory/territory.module.js';
import { RoutesModule } from './routes/routes.module.js';
import { TargetsModule } from './targets/targets.module.js';
import { IncentiveRulesModule } from './incentive-rules/incentive-rules.module.js';
import { TargetIncentiveModule } from './target-incentive/target-incentive.module.js';

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
    IncentivesModule,
    AttendanceModule,
    BillingModule,
    TerritoryModule,
    RoutesModule,
    TargetsModule,
    IncentiveRulesModule,
    TargetIncentiveModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
