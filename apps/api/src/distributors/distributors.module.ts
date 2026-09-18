import { Module } from '@nestjs/common';
import { DistributorsController } from './distributors.controller.js';
import { DistributorsService } from './distributors.service.js';

@Module({ controllers: [DistributorsController], providers: [DistributorsService] })
export class DistributorsModule {}
