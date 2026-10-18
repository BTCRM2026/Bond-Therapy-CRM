import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class LeaveRangeDto {
  @Matches(datePattern, { message: 'Enter a valid start date.' }) startDate!: string;
  @Matches(datePattern, { message: 'Enter a valid end date.' }) endDate!: string;
}

export class CreateLeaveDto extends LeaveRangeDto {
  @Transform(trim) @IsString() @MinLength(3, { message: 'Add a short reason for your leave.' }) @MaxLength(500, { message: 'Reason can be up to 500 characters.' })
  reason!: string;
}

export class ReviewLeaveDto {
  @IsIn(['APPROVED', 'REJECTED'], { message: 'Choose approve or reject.' }) status!: 'APPROVED' | 'REJECTED';
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) reviewNote?: string;
}

export class LeavePageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

export class LeaveListDto extends LeavePageDto {
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export class LeaveMonthDto {
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Month must look like 2026-10.' }) month?: string;
}
