import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { IncentiveCalcType, IncentiveRuleStatus, IncentiveSourceType, ProductCategory } from '@prisma/client';

export class IncentiveRuleDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class SlabDto {
  @Type(() => Number) @Min(0) minAmount!: number;
  @IsOptional() @Type(() => Number) @Min(0) maxAmount?: number;
  @IsOptional() @Type(() => Number) @Min(0) @Max(100) percent?: number;
  @IsOptional() @Type(() => Number) @Min(0) fixedAmount?: number;
}

export class IncentiveRuleVersionDto {
  @IsEnum(IncentiveSourceType) sourceType!: IncentiveSourceType;
  @IsEnum(IncentiveCalcType) calcType!: IncentiveCalcType;
  @IsOptional() @Type(() => Number) @Min(0) @Max(100) percent?: number;
  @IsOptional() @Type(() => Number) @Min(0) fixedAmount?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => SlabDto) slabs?: SlabDto[];
  @IsOptional() @IsArray() @IsString({ each: true }) roleEligibility?: string[];
  @IsOptional() @IsArray() @IsEnum(ProductCategory, { each: true }) productCategoryEligibility?: ProductCategory[];
  @IsOptional() @Type(() => Number) @Min(0) minThreshold?: number;
  @IsOptional() @Type(() => Number) @Min(0) maxThreshold?: number;
  @IsString() effectiveFrom!: string;
  @IsOptional() @IsString() effectiveUntil?: string;
  @IsOptional() @IsBoolean() requiresApproval?: boolean;
  @IsOptional() @IsEnum(IncentiveRuleStatus) status?: IncentiveRuleStatus;
}

export class RunCalculationDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(12) periodMonth!: number;
  @Type(() => Number) @IsInt() @Min(2020) @Max(2100) periodYear!: number;
}

export class RejectCalculationDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
