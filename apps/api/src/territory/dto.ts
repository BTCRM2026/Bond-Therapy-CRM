import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RegionDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(20) code?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class StateDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) regionId!: string;
  @IsOptional() @IsString() @MaxLength(20) code?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AreaDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) cityId!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CityDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) stateId!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class TerritoryDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) areaId!: string;
  @IsOptional() @IsString() @MaxLength(20) code?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class TerritoryAllocationDto {
  @IsString() @MinLength(1) userId!: string;
  @IsString() @MinLength(1) territoryId!: string;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsOptional() @IsString() replaceAssignmentId?: string;
}

export class EndTerritoryAllocationDto {
  @IsDateString() endDate!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class BeatDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) territoryId!: string;
  @IsOptional() @IsString() assignedStaffId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) visitFrequencyDays?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) preferredVisitDays?: number[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}
