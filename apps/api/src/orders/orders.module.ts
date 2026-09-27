import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { PartnerOrdersController } from './partner-orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({ controllers: [OrdersController, PartnerOrdersController], providers: [OrdersService] })
export class OrdersModule {}
