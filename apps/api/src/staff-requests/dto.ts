import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { StaffRequestStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateRequestDto {
  @Transform(trim) @IsString() @MinLength(3, { message: 'Add a short title of at least 3 characters.' }) @MaxLength(160, { message: 'Keep the title to one line (160 characters).' })
  title!: string;

  @Transform(trim) @IsString() @MinLength(5, { message: 'Explain what you need and why.' }) @MaxLength(4000, { message: 'Details can be up to 4000 characters.' })
  details!: string;
}

export class DecideRequestDto {
  @IsEnum(['APPROVE', 'REJECT', 'NEED_INFO'] as const, { message: 'Choose approve, reject or need more info.' })
  decision!: 'APPROVE' | 'REJECT' | 'NEED_INFO';

  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000, { message: 'Comment can be up to 1000 characters.' })
  comment?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(120, { message: 'Approved value can be up to 120 characters.' })
  approvedValue?: string;

  @IsOptional() @IsDateString({}, { message: 'Enter a valid validity date.' })
  validUntil?: string;
}

export class ReplyRequestDto {
  @Transform(trim) @IsString() @MinLength(1, { message: 'Type your reply first.' }) @MaxLength(2000, { message: 'Reply can be up to 2000 characters.' })
  comment!: string;
}

export class ListRequestsDto {
  @IsOptional() @IsEnum(StaffRequestStatus) status?: StaffRequestStatus;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
