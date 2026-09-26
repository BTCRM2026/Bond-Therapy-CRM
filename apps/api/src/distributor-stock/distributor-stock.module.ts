import { Module } from '@nestjs/common';
import { DistributorStockController } from './distributor-stock.controller.js';
import { DistributorStockService } from './distributor-stock.service.js';

@Module({ controllers: [DistributorStockController], providers: [DistributorStockService] })
export class DistributorStockModule {}
