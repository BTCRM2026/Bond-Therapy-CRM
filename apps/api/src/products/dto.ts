import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ProductCategory, StockMovementType } from '@prisma/client';

export class ListProductsDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsEnum(ProductCategory) category?: ProductCategory;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize = 100;
}

export class ProductDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsEnum(ProductCategory) category!: ProductCategory;
  @IsOptional() @IsString() @MaxLength(80) variant?: string;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice!: number;
  @IsOptional() @IsString() @MaxLength(20) hsnCode?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) gstRate?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stockOnHand?: number;
}

export class SetProductActiveDto {
  @IsBoolean() isActive!: boolean;
}

export class StockMovementDto {
  @IsEnum(StockMovementType) type!: StockMovementType;
  @IsInt() quantityChange!: number;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class ListMovementsDto {
  @IsOptional() @IsString() @IsNotEmpty() productId?: string;
}
