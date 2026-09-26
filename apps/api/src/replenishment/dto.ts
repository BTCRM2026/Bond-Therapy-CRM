import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { ReplenishmentStatus } from '@prisma/client';

export class ReplenishmentItemDto {
  @IsString() @MinLength(1) productId!: string;
  @IsInt() @Min(1) @Max(100000) quantity!: number;
}

export class CreateReplenishmentDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReplenishmentItemDto) items!: ReplenishmentItemDto[];
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class ListReplenishmentDto {
  @IsOptional() @IsEnum(ReplenishmentStatus) status?: ReplenishmentStatus;
  @IsOptional() @IsString() distributorId?: string;
}

export class ReviewReplenishmentDto {
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

export class ListReplenishableProductsDto {
  @IsOptional() @IsString() search?: string;
}
