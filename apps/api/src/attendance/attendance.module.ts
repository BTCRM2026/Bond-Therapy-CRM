import { Module } from '@nestjs/common';
import { LeaveModule } from '../leave/leave.module.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

@Module({ imports: [LeaveModule], controllers: [AttendanceController], providers: [AttendanceService] })
export class AttendanceModule {}
