import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class GenerateIncentiveDto {
  @IsString() @MinLength(1) userId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) periodMonth!: number;
  @Type(() => Number) @IsInt() @Min(2020) @Max(2100) periodYear!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) ratePercent!: number;
}

export class PeriodQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) month?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2020) @Max(2100) year?: number;
}
