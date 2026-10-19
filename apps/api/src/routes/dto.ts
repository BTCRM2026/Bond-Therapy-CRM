import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { ClientCategory, VisitOutcome } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

// A salon the salesperson types by name because it has no client profile yet; it is saved as a prospect client assigned to them.
export class AddSalonByNameDto {
  @Transform(trim) @IsString() @MinLength(2, { message: 'Enter the salon name.' }) @MaxLength(120) name!: string;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Enter the town.' }) @MaxLength(100) city!: string;
}

export class RouteStopInputDto {
  @IsString() @MinLength(1) clientId!: string;
  @IsOptional() @IsString() plannedTime?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class SaveRouteDto {
  @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => RouteStopInputDto) stops!: RouteStopInputDto[];
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class StopStatusDto {
  @IsIn(['UNABLE_TO_MEET', 'RESCHEDULED', 'REMOVED']) status!: 'UNABLE_TO_MEET' | 'RESCHEDULED' | 'REMOVED';
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @IsOptional() @IsString() rescheduleDate?: string;
}

// Check-out is only a time stamp: no photo and no GPS are required.
export class CompleteVisitDto {
  @IsOptional() @IsEnum(VisitOutcome) outcome?: VisitOutcome;
  @IsOptional() @IsString() @MaxLength(160) personMet?: string;
  @IsOptional() @IsString() @MaxLength(160) purpose?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsIn(['true', 'false']) sampleGiven?: 'true' | 'false';
  @IsOptional() @IsString() @MaxLength(300) nextAction?: string;
}

// Arrival must be matched to the salon's saved location; accuracy is the GPS error reported by the phone, in metres.
export class StartVisitDto {
  // The one-time pass issued when the in-app camera opened.
  @IsOptional() @IsString() @MaxLength(100) captureToken?: string;
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) accuracy?: number;
}

// The profile a salesperson fills in at a salon that was typed into the route by name. The location is the phone's GPS at that moment.
export class CompleteSalonProfileDto {
  @Transform(trim) @IsString() @MinLength(2, { message: 'Enter the salon name.' }) @MaxLength(160) salonName!: string;
  @IsEnum(ClientCategory, { message: 'Choose the salon type.' }) category!: ClientCategory;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Enter the owner name.' }) @MaxLength(120) ownerName!: string;
  @Transform(trim) @IsString() @MinLength(7, { message: 'Enter a valid contact number.' }) @MaxLength(20) primaryContact!: string;
  @Transform(trim) @IsString() @MinLength(5, { message: 'Enter the salon address.' }) @MaxLength(500) fullAddress!: string;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Enter the town.' }) @MaxLength(100) city!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) area?: string;
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) accuracy?: number;
}

export class SalonLocationDto {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) accuracy?: number;
}

export class AdminVisitsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() staffId?: string;
  @IsOptional() @IsString() territory?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsIn(['verified', 'outside', 'skipped']) gps?: 'verified' | 'outside' | 'skipped';
  @IsOptional() @IsString() @MaxLength(120) search?: string;
}
