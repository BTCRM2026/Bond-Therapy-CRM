import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ExchangeDisposition, ExchangeReason, ExchangeStatus } from '@prisma/client';

export class CreateExchangeItemDto {
  @IsString() orderItemId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) quantity!: number;
  @IsEnum(ExchangeReason) reason!: ExchangeReason;
  @IsOptional() @IsString() replacementProductId?: string;
  @IsOptional() @IsString() @MaxLength(80) batchNumber?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
}

export class CreateExchangeDto {
  @IsString() orderId!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateExchangeItemDto) items!: CreateExchangeItemDto[];
  @IsOptional() @IsBoolean() pickupRequired?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) salonRemarks?: string;
}

export class ExchangeItemDecisionDto {
  @IsString() itemId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) approvedQuantity?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) receivedQuantity?: number;
  @IsOptional() @IsEnum(ExchangeDisposition) disposition?: ExchangeDisposition;
  @IsOptional() @IsString() @MaxLength(500) inspectionNotes?: string;
  @IsOptional() @IsString() replacementProductId?: string;
}

export class UpdateExchangeStatusDto {
  @IsEnum(ExchangeStatus) status!: ExchangeStatus;
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() @MaxLength(120) resolutionReference?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) creditAmount?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ExchangeItemDecisionDto) items?: ExchangeItemDecisionDto[];
}

export class ListExchangesDto {
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsEnum(ExchangeStatus) status?: ExchangeStatus;
}
