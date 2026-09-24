import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RegionDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(20) code?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class StateDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) regionId!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CityDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) stateId!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class TerritoryDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) regionId!: string;
  @IsString() @MinLength(1) stateId!: string;
  @IsString() @MinLength(1) cityId!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class BeatDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) territoryId!: string;
  @IsOptional() @IsString() assignedStaffId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) visitFrequencyDays?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) preferredVisitDays?: number[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}
