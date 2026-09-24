import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { TargetMetric, TargetPeriod, TargetScope } from '@prisma/client';

export class TargetDto {
  @IsEnum(TargetScope) scope!: TargetScope;
  @IsString() @MinLength(1) scopeId!: string;
  @IsEnum(TargetMetric) metric!: TargetMetric;
  @IsEnum(TargetPeriod) period!: TargetPeriod;
  @Type(() => Number) @IsInt() @Min(2020) @Max(2100) periodYear!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) periodIndex!: number;
  @Type(() => Number) @Min(0) targetValue!: number;
}

export class ListTargetsDto {
  @IsOptional() @IsEnum(TargetPeriod) period?: TargetPeriod;
  @IsOptional() @Type(() => Number) @IsInt() periodYear?: number;
  @IsOptional() @Type(() => Number) @IsInt() periodIndex?: number;
  @IsOptional() @IsEnum(TargetScope) scope?: TargetScope;
}

export class PerformanceQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) month?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2020) @Max(2100) year?: number;
}
