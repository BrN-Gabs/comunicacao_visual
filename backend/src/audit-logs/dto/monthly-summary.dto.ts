import { Transform } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class MonthlySummaryDto {
  @Transform(({ value }) => Number(value))
  @IsNumber()
  year: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;
}
