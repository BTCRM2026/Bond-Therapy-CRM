import { Module } from '@nestjs/common';
import { TerritoryController } from './territory.controller.js';
import { TerritoryService } from './territory.service.js';

@Module({ controllers: [TerritoryController], providers: [TerritoryService] })
export class TerritoryModule {}
