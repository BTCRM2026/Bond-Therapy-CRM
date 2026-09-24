import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { VisitOutcome } from '@prisma/client';

export class RouteStopInputDto {
  @IsString() @MinLength(1) clientId!: string;
  @IsOptional() @IsString() plannedTime?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class SaveRouteDto {
  @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => RouteStopInputDto) stops!: RouteStopInputDto[];
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class StopStatusDto {
  @IsIn(['UNABLE_TO_MEET', 'RESCHEDULED', 'REMOVED']) status!: 'UNABLE_TO_MEET' | 'RESCHEDULED' | 'REMOVED';
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @IsOptional() @IsString() rescheduleDate?: string;
}

export class CompleteVisitDto {
  @IsEnum(VisitOutcome) outcome!: VisitOutcome;
  @IsOptional() @IsString() @MaxLength(160) personMet?: string;
  @IsOptional() @IsString() @MaxLength(160) purpose?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsBoolean() sampleGiven?: boolean;
  @IsOptional() @IsString() @MaxLength(300) nextAction?: string;
}
