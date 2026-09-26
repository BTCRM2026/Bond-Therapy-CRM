import { IsDateString, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LETTER_TYPES, type LetterType } from './letter-types.js';

export class CreateHrLetterDto {
  @IsIn(LETTER_TYPES) type!: LetterType;
  @IsString() @MinLength(2) @MaxLength(160) recipientName!: string;
  @IsOptional() @IsString() @MaxLength(160) recipientDesignation?: string;
  @IsOptional() @IsString() @MaxLength(120) recipientDepartment?: string;
  @IsOptional() @IsString() staffUserId?: string;
  @IsOptional() @IsDateString() issuedDate?: string;
  @IsObject() details!: Record<string, string>;
}

export class ListHrLettersDto {
  @IsOptional() @IsIn(LETTER_TYPES) type?: LetterType;
  @IsOptional() @IsString() search?: string;
}
