import { Module } from '@nestjs/common';
import { AgreementsController } from './agreements.controller.js';
import { AgreementsService } from './agreements.service.js';

@Module({ controllers: [AgreementsController], providers: [AgreementsService] })
export class AgreementsModule {}
