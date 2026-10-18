import { Module } from '@nestjs/common';
import { CapturesModule } from '../captures/captures.module.js';
import { DayRulesModule } from '../day-rules/day-rules.module.js';
import { RoutesController } from './routes.controller.js';
import { RoutesService } from './routes.service.js';

@Module({ imports: [CapturesModule, DayRulesModule], controllers: [RoutesController], providers: [RoutesService] })
export class RoutesModule {}
