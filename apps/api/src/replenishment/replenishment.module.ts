import { Module } from '@nestjs/common';
import { ReplenishmentController } from './replenishment.controller.js';
import { PartnerReplenishmentController } from './partner-replenishment.controller.js';
import { ReplenishmentService } from './replenishment.service.js';

@Module({ controllers: [ReplenishmentController, PartnerReplenishmentController], providers: [ReplenishmentService] })
export class ReplenishmentModule {}
