import { Module } from '@nestjs/common';
import { DayRulesService } from './day-rules.service.js';

@Module({ providers: [DayRulesService], exports: [DayRulesService] })
export class DayRulesModule {}
