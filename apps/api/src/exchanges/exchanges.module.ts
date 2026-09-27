import { Module } from '@nestjs/common';
import { ExchangesController } from './exchanges.controller.js';
import { ExchangesService } from './exchanges.service.js';

@Module({ controllers: [ExchangesController], providers: [ExchangesService] })
export class ExchangesModule {}
