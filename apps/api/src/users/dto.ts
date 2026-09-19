import { IsDateString, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const employmentTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'] as const;
const bloodGroups = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'] as const;
const phonePattern = /^[0-9+() -]{7,20}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateUserDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Matches(phonePattern, { message: 'Enter a valid mobile number.' })
  mobile!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  jobTitle!: string;

  @IsIn(employmentTypes)
  employmentType!: (typeof employmentTypes)[number];

  @IsDateString()
  joiningDate!: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @Matches(timePattern, { message: 'Shift start must use HH:mm.' })
  shiftStart?: string;

  @IsOptional()
  @Matches(timePattern, { message: 'Shift end must use HH:mm.' })
  shiftEnd?: string;

  @IsOptional()
  @IsIn(bloodGroups)
  bloodGroup?: (typeof bloodGroups)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  residentialAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string;

  @IsOptional()
  @Matches(phonePattern, { message: 'Enter a valid emergency contact number.' })
  emergencyContactMobile?: string;

  @IsString()
  roleKey!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  managerId?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'LOCKED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED';

  @IsOptional()
  @IsString()
  roleKey?: string;

  @IsOptional()
  managerId?: string | null;

  @IsOptional()
  @Matches(phonePattern, { message: 'Enter a valid mobile number.' })
  mobile?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  jobTitle?: string;

  @IsOptional()
  @IsIn(employmentTypes)
  employmentType?: (typeof employmentTypes)[number];

  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @IsOptional()
  @Matches(timePattern, { message: 'Shift start must use HH:mm.' })
  shiftStart?: string | null;

  @IsOptional()
  @Matches(timePattern, { message: 'Shift end must use HH:mm.' })
  shiftEnd?: string | null;

  @IsOptional()
  @IsIn(bloodGroups)
  bloodGroup?: (typeof bloodGroups)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workLocation?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  residentialAddress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string | null;

  @IsOptional()
  @Matches(phonePattern, { message: 'Enter a valid emergency contact number.' })
  emergencyContactMobile?: string | null;
}

export class UpdateStaffPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
