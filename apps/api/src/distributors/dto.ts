import { IsIn, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDistributorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  businessName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  territory?: string;

  @IsOptional()
  @IsNumber()
  creditLimit?: number;

  @IsOptional()
  @IsString()
  assignedSalespersonId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDistributorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  territory?: string;

  @IsOptional()
  @IsNumber()
  creditLimit?: number;

  @IsOptional()
  @IsString()
  assignedSalespersonId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['ONBOARDING', 'ACTIVE', 'INACTIVE'])
  status?: 'ONBOARDING' | 'ACTIVE' | 'INACTIVE';
}
