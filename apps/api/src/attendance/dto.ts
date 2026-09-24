import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AttendanceMonthQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) month?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2020) @Max(2100) year?: number;
}

export class PunchDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
}

export class RequestCorrectionDto {
  @IsDateString() date!: string;
  @IsOptional() @IsDateString() requestedPunchIn?: string;
  @IsOptional() @IsDateString() requestedPunchOut?: string;
  @IsString() @MinLength(2) @MaxLength(500) reason!: string;
}

export class ReviewRequestDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(500) reviewNote?: string;
}

export class RequestLeaveDto {
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsString() @MinLength(2) @MaxLength(500) reason!: string;
}

export class HolidayDto {
  @IsDateString() date!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
}

export class UpdateOperationsSettingsDto {
  @IsOptional() @Type(() => Number) @Min(-90) @Max(90) officeLatitude?: number | null;
  @IsOptional() @Type(() => Number) @Min(-180) @Max(180) officeLongitude?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(10) @Max(5000) officeRadiusMeters?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(10) @Max(5000) visitRadiusMeters?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(180) lateThresholdMinutes?: number;
  @IsOptional() @Type(() => Number) @Min(0) @Max(12) halfDayThresholdHours?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) weeklyOffDays?: number[];
}

export class AdminAttendanceListDto {
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
