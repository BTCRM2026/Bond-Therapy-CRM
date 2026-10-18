import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

export class BoardQueryDto extends PageDto {
  @IsOptional() @Matches(DATE, { message: 'Date must look like 2026-10-17.' }) date?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(['all', 'missing-report', 'not-working']) show?: 'all' | 'missing-report' | 'not-working';
}

export class DayQueryDto {
  @IsOptional() @Matches(DATE, { message: 'Date must look like 2026-10-17.' }) date?: string;
}

export class TeamLeadsQueryDto extends PageDto {
  @IsOptional() @IsString() @MaxLength(40) staffId?: string;
  @IsOptional() @IsIn(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']) status?: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
}

export class TeamActivitiesQueryDto extends PageDto {
  @IsOptional() @IsString() @MaxLength(40) staffId?: string;
  @IsOptional() @IsIn(['FOLLOW_UP', 'DEMO', 'SAMPLE']) type?: 'FOLLOW_UP' | 'DEMO' | 'SAMPLE';
  @IsOptional() @IsIn(['open', 'overdue', 'completed', 'all']) scope?: 'open' | 'overdue' | 'completed' | 'all';
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
}
