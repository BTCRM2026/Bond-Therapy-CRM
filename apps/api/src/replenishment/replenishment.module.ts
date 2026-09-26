import { Module } from '@nestjs/common';
import { ReplenishmentController } from './replenishment.controller.js';
import { ReplenishmentService } from './replenishment.service.js';

@Module({ controllers: [ReplenishmentController], providers: [ReplenishmentService] })
export class ReplenishmentModule {}
