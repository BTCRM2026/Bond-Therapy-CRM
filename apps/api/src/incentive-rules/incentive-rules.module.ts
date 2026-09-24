import { Module } from '@nestjs/common';
import { IncentiveRulesController } from './incentive-rules.controller.js';
import { IncentiveRulesService } from './incentive-rules.service.js';

@Module({ controllers: [IncentiveRulesController], providers: [IncentiveRulesService] })
export class IncentiveRulesModule {}
