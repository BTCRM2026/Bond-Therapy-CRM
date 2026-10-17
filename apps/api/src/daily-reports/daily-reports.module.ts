import { Module } from '@nestjs/common';
import { CapturesModule } from '../captures/captures.module.js';
import { DailyReportsController } from './daily-reports.controller.js';
import { DailyReportsService } from './daily-reports.service.js';

@Module({ imports: [CapturesModule], controllers: [DailyReportsController], providers: [DailyReportsService] })
export class DailyReportsModule {}
