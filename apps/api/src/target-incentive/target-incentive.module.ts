import { Module } from '@nestjs/common';
import { TargetIncentiveController } from './target-incentive.controller.js';
import { TargetIncentiveService } from './target-incentive.service.js';

@Module({ controllers: [TargetIncentiveController], providers: [TargetIncentiveService] })
export class TargetIncentiveModule {}
