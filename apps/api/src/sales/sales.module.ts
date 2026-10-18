import { Module } from '@nestjs/common';
import { DayRulesModule } from '../day-rules/day-rules.module.js';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';

@Module({ imports: [DayRulesModule], controllers: [SalesController], providers: [SalesService] })
export class SalesModule {}
