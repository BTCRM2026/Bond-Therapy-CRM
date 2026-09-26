import { IsOptional, IsString } from 'class-validator';

export class ListDistributorStockDto {
  @IsOptional()
  @IsString()
  distributorId?: string;
}
