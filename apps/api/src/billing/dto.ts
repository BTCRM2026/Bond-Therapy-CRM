import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { InvoiceStatus, PaymentMode } from '@prisma/client';

export class UpdateBillingSettingsDto {
  @IsString() @MinLength(2) @MaxLength(160) legalName!: string;
  @IsString() @MinLength(2) @MaxLength(160) tradeName!: string;
  @IsOptional() @IsString() @MaxLength(30) gstin?: string;
  @IsOptional() @IsString() @MaxLength(20) pan?: string;
  @IsOptional() @IsString() @MaxLength(500) registeredAddress?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
  @IsOptional() @IsString() @MaxLength(5) stateCode?: string;
  @IsOptional() @IsString() @MaxLength(10) pincode?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(160) website?: string;
  @IsOptional() @IsString() @MaxLength(120) bankName?: string;
  @IsOptional() @IsString() @MaxLength(160) accountName?: string;
  @IsOptional() @IsString() @MaxLength(40) accountNumber?: string;
  @IsOptional() @IsString() @MaxLength(20) ifsc?: string;
  @IsOptional() @IsString() @MaxLength(120) branch?: string;
  @IsOptional() @IsString() @MaxLength(100) upiId?: string;
  @IsString() @MinLength(1) @MaxLength(12) invoicePrefix!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) defaultGstRate!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(365) defaultPaymentTermsDays!: number;
  @IsBoolean() allowSalesDiscount!: boolean;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) maxSalesDiscountPercent!: number;
  @IsOptional() @IsString() @MaxLength(2000) invoiceTerms?: string;
  @IsOptional() @IsString() @MaxLength(500) footerNote?: string;
  @IsOptional() @IsString() @MaxLength(160) accountManagerName?: string;
  @IsOptional() @IsString() @MaxLength(80) accountManagerTitle?: string;
}

export class ListInvoicesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsEnum(InvoiceStatus) status?: InvoiceStatus;
  @IsOptional() @IsString() search?: string;
}

export class UpdateInvoiceStatusDto { @IsEnum(InvoiceStatus) status!: InvoiceStatus; }

export class RecordPaymentDto {
  @IsString() paymentDate!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @IsEnum(PaymentMode) mode!: PaymentMode;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
