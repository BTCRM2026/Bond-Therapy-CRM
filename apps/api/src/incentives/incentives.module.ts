import { Module } from '@nestjs/common';
import { IncentivesController } from './incentives.controller.js';
import { IncentivesService } from './incentives.service.js';

@Module({ controllers: [IncentivesController], providers: [IncentivesService] })
export class IncentivesModule {}
