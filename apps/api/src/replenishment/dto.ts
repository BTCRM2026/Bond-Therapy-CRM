import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
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
  @IsOptional() @IsString() @MaxLength(100) invoiceReference?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReplenishmentDecisionItemDto) items?: ReplenishmentDecisionItemDto[];
}

export class ReplenishmentDecisionItemDto {
  @IsString() @MinLength(1) itemId!: string;
  @IsInt() @Min(0) @Max(100000) quantity!: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) damagedQuantity?: number;
}

export class ListReplenishableProductsDto {
  @IsOptional() @IsString() search?: string;
}

export class PartnerReplenishmentActionDto extends ReviewReplenishmentDto {
  @IsIn(['approve', 'reject', 'pick', 'pack', 'fulfill']) action!: 'approve' | 'reject' | 'pick' | 'pack' | 'fulfill';
}
