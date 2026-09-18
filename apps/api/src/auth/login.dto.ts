import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  identifier!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsBoolean()
  @IsOptional()
  remember = false;
}

