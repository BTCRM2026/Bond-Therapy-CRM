import { Module } from '@nestjs/common';
import { DailyReportsController } from './daily-reports.controller.js';
import { DailyReportsService } from './daily-reports.service.js';

@Module({ controllers: [DailyReportsController], providers: [DailyReportsService] })
export class DailyReportsModule {}
