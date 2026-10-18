import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
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
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
  @IsOptional() @IsIn(LETTER_TYPES) type?: LetterType;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'GENERATED', 'SENT', 'ACKNOWLEDGED', 'REJECTED', 'SUPERSEDED', 'CANCELLED']) status?: string;
}

export class UpdateHrLetterDto extends CreateHrLetterDto {}

export class HrLetterActionDto {
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}
