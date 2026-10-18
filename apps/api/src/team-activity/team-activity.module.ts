import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { MyDayController, TeamActivityController } from './team-activity.controller.js';
import { TeamActivityService } from './team-activity.service.js';

@Module({ imports: [AttendanceModule], controllers: [TeamActivityController, MyDayController], providers: [TeamActivityService] })
export class TeamActivityModule {}
