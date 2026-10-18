import { Module } from '@nestjs/common';
import { DayRulesModule } from '../day-rules/day-rules.module.js';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';

@Module({ imports: [DayRulesModule], controllers: [ClientsController], providers: [ClientsService] })
export class ClientsModule {}
