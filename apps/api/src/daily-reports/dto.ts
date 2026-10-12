import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { DailyCallCustomerType, DailyCallResult } from '@prisma/client';

export class DailyCallDto {
  @IsOptional() @IsString() @MaxLength(40) existingCallId?: string;
  @IsString() @MinLength(2) @MaxLength(160) customerName!: string;
  @IsEnum(DailyCallCustomerType) customerType!: DailyCallCustomerType;
  @IsEnum(DailyCallResult) result!: DailyCallResult;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(9999999999) orderValue?: number;
  @IsOptional() @IsString() @MaxLength(240) remark?: string;
}

export class SaveDailyReportDto {
  @IsString() @MinLength(2) @MaxLength(100) workingTown!: string;
  @IsOptional() @IsString() @MaxLength(40) coworkerId?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => DailyCallDto) calls!: DailyCallDto[];
  @IsOptional() @IsString() @MaxLength(500) noOrderReason?: string;
  @IsString() @MinLength(2) @MaxLength(100) tomorrowTown!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(60) @ArrayUnique() @IsString({ each: true }) tomorrowClientIds!: string[];
}
