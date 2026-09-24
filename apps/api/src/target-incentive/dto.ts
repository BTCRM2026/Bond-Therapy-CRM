import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { AnnualDistributionType, IncentiveBasis, SlabValueType, TargetIncentiveType, TargetPeriod } from '@prisma/client';

export class SeasonDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  @Type(() => Number) @Min(0.01) @Max(100) weightagePercent!: number;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
}

export class SlabDto {
  @Type(() => Number) @Min(0) @Max(1000) minAchievementPercent!: number;
  @IsOptional() @Type(() => Number) @Min(0) @Max(1000) maxAchievementPercent?: number;
  @IsEnum(SlabValueType) valueType!: SlabValueType;
  @Type(() => Number) @Min(0) value!: number;
}

export class UpsertPlanDto {
  @IsString() @MinLength(1) staffId!: string;
  @Type(() => Number) @IsInt() @Min(2020) @Max(2100) targetYear!: number;
  @Type(() => Number) @Min(0) annualTarget!: number;
  @IsEnum(AnnualDistributionType) distributionType!: AnnualDistributionType;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => SeasonDto) seasons?: SeasonDto[];

  @IsEnum(TargetIncentiveType) incentiveType!: TargetIncentiveType;
  @IsEnum(IncentiveBasis) calculationBasis!: IncentiveBasis;
  @IsOptional() @Type(() => Number) @Min(0) @Max(100) percentValue?: number;
  @IsOptional() @Type(() => Number) @Min(0) fixedAmount?: number;
  @Type(() => Number) @Min(0) @Max(1000) minAchievementPercent!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => SlabDto) slabs?: SlabDto[];
}

export class PerformanceQueryDto {
  @IsEnum(TargetPeriod) period!: TargetPeriod;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2020) @Max(2100) year?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) index?: number;
}
