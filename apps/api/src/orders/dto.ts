import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { DeliveryMode, OrderStatus } from '@prisma/client';

export class OrderItemDto {
  @IsString() @MinLength(1) productId!: string;
  @IsInt() @Min(1) @Max(100000) quantity!: number;
}

export class CreateOrderDto {
  @IsString() @MinLength(1) clientId!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => OrderItemDto) items!: OrderItemDto[];
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) discountAmount?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdateOrderDto extends CreateOrderDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class ListOrdersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() distributorId?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus) status!: OrderStatus;
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
  @IsOptional() @IsEnum(DeliveryMode) deliveryMode?: DeliveryMode;
  @IsOptional() @IsString() @MaxLength(120) deliveryPersonName?: string;
  @IsOptional() @IsString() @MaxLength(20) deliveryPersonMobile?: string;
  @IsOptional() @IsString() @MaxLength(120) courierName?: string;
  @IsOptional() @IsString() @MaxLength(120) trackingNumber?: string;
  @IsOptional() @IsString() @MaxLength(120) distributorInvoiceReference?: string;
}
