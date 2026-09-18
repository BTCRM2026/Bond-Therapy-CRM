import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const PARTY_TYPES = ['DISTRIBUTOR', 'SUPPLIER', 'EMPLOYEE'] as const;
const STATUSES = ['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'TERMINATED'] as const;

export class CreateAgreementDto {
  @IsIn(PARTY_TYPES)
  partyType!: (typeof PARTY_TYPES)[number];

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  partyName!: string;

  @IsOptional()
  @IsString()
  distributorId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsDateString()
  signedDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAgreementDto {
  @IsOptional()
  @IsIn(PARTY_TYPES)
  partyType?: (typeof PARTY_TYPES)[number];

  @IsOptional()
  @IsString()
  partyName?: string;

  @IsOptional()
  @IsString()
  distributorId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  signedDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  notes?: string;
}
