import { Module } from '@nestjs/common';
import { CapturesModule } from '../captures/captures.module.js';
import { DayRulesModule } from '../day-rules/day-rules.module.js';
import { DailyReportsController } from './daily-reports.controller.js';
import { DailyReportsService } from './daily-reports.service.js';

@Module({ imports: [CapturesModule, DayRulesModule], controllers: [DailyReportsController], providers: [DailyReportsService] })
export class DailyReportsModule {}
