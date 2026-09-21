import { IsArray, IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ClientActivityStatus, ClientActivityType, ClientCategory, ClientPotential, ClientStatus, CustomerSegment, DemoOutcome } from '@prisma/client';

export class ListClientsDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsEnum(ClientStatus) status?: ClientStatus;
  @IsOptional() @IsEnum(ClientCategory) category?: ClientCategory;
  @IsOptional() @IsEnum(ClientPotential) potential?: ClientPotential;
  @IsOptional() @IsEnum(CustomerSegment) customerSegment?: CustomerSegment;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

export class ClientDto {
  @IsString() @MinLength(2) @MaxLength(160) salonName!: string;
  @IsEnum(ClientCategory) category!: ClientCategory;
  @IsOptional() @IsEnum(ClientStatus) status?: ClientStatus;
  @IsOptional() @IsString() @MaxLength(120) ownerName?: string;
  @IsOptional() @IsString() @MaxLength(120) managerName?: string;
  @IsString() @MinLength(7) @MaxLength(20) primaryContact!: string;
  @IsOptional() @IsString() @MaxLength(20) whatsappNumber?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(120) keyProfessional?: string;
  @IsOptional() @IsString() @MaxLength(500) fullAddress?: string;
  @IsOptional() @IsString() @MaxLength(120) area?: string;
  @IsString() @MinLength(2) @MaxLength(100) city!: string;
  @IsOptional() @IsString() @MaxLength(10) pincode?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(500) googleMapsUrl?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) chairCount?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) staffCount?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) stylistCount?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) approximateDailyCustomers?: number;
  @IsOptional() @IsEnum(ClientPotential) potential?: ClientPotential;
  @IsOptional() @IsEnum(CustomerSegment) customerSegment?: CustomerSegment;
  @IsOptional() @Min(0) estimatedMonthlyBusiness?: number;
  @IsOptional() @IsString() @MaxLength(80) purchasingFrequency?: string;
  @IsOptional() @IsString() @MaxLength(120) territory?: string;
  @IsOptional() @IsString() @MaxLength(120) routeBeat?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) businessPotentialRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) relationshipRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) paymentBehaviourRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) productOpportunityRating?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) overallRating?: number;
  @IsOptional() @IsString() assignedSalespersonId?: string;
  @IsOptional() @IsString() assignedTrainerId?: string;
  @IsOptional() @IsString() distributorId?: string;
  @IsOptional() @IsInt() @Min(1) version?: number;
  @IsOptional() continueOnDuplicate?: boolean;
}

export class RequestedProductDto {
  @IsString() productId!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class ClientActivityDto {
  @IsEnum(ClientActivityType) type!: ClientActivityType;
  @IsOptional() @IsEnum(ClientActivityStatus) status?: ClientActivityStatus;
  @IsOptional() @IsString() @MaxLength(160) purpose?: string;
  @IsOptional() @IsString() @MaxLength(120) personMet?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsString() scheduledAt?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000) attendeeCount?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RequestedProductDto) requestedProducts?: RequestedProductDto[];
}

export class ListActivitiesDto {
  @IsOptional() @IsIn(['open', 'overdue', 'all']) scope?: 'open' | 'overdue' | 'all';
  @IsOptional() @IsEnum(ClientActivityType) type?: ClientActivityType;
}

export class UpdateActivityStatusDto {
  @IsEnum(ClientActivityStatus) status!: ClientActivityStatus;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsEnum(DemoOutcome) outcome?: DemoOutcome;
}
