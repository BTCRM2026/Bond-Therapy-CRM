import { Module } from '@nestjs/common';
import { CapturesModule } from '../captures/captures.module.js';
import { ExchangesController } from './exchanges.controller.js';
import { ExchangesService } from './exchanges.service.js';

@Module({ imports: [CapturesModule], controllers: [ExchangesController], providers: [ExchangesService] })
export class ExchangesModule {}
