import { Module } from '@nestjs/common';
import { DayRulesModule } from '../day-rules/day-rules.module.js';
import { LeaveModule } from '../leave/leave.module.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

@Module({ imports: [LeaveModule, DayRulesModule], controllers: [AttendanceController], providers: [AttendanceService], exports: [AttendanceService] })
export class AttendanceModule {}
