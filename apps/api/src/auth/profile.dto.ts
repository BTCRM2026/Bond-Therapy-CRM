import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const bloodGroups = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'] as const;
const phonePattern = /^[0-9+() -]{7,20}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

// Personal details a staff member fills in once from Settings; an administrator controls everything else.
export class StaffDetailsDto {
  @Transform(trim) @Matches(phonePattern, { message: 'Enter a valid mobile number.' })
  mobile!: string;

  @Transform(trim) @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(254)
  email!: string;

  @IsDateString({}, { message: 'Enter your date of birth.' })
  dateOfBirth!: string;

  @IsOptional() @IsIn(bloodGroups, { message: 'Select a valid blood group.' })
  bloodGroup?: (typeof bloodGroups)[number];

  @IsDateString({}, { message: 'Enter your joining date.' })
  joiningDate!: string;

  @Transform(trim) @IsString() @MinLength(2, { message: 'Enter your work location.' }) @MaxLength(120)
  workLocation!: string;

  @Transform(trim) @IsString() @MinLength(5, { message: 'Enter your residential address.' }) @MaxLength(500)
  residentialAddress!: string;

  @Transform(trim) @IsString() @MinLength(2, { message: 'Enter the emergency contact name.' }) @MaxLength(120)
  emergencyContactName!: string;

  @Transform(trim) @Matches(phonePattern, { message: 'Enter a valid emergency contact number.' })
  emergencyContactMobile!: string;
}
