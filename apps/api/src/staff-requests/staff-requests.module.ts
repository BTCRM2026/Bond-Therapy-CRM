import { Module } from '@nestjs/common';
import { StaffRequestsController } from './staff-requests.controller.js';
import { StaffRequestsService } from './staff-requests.service.js';

@Module({ controllers: [StaffRequestsController], providers: [StaffRequestsService] })
export class StaffRequestsModule {}
