import { Module } from '@nestjs/common';
import { CapturesModule } from '../captures/captures.module.js';
import { RoutesController } from './routes.controller.js';
import { RoutesService } from './routes.service.js';

@Module({ imports: [CapturesModule], controllers: [RoutesController], providers: [RoutesService] })
export class RoutesModule {}
