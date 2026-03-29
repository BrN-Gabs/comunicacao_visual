import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateFrameImageLayoutDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(3)
  cityImageZoom: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(100)
  cityImageOffsetX: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(100)
  cityImageOffsetY: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(3)
  gazinImageZoom: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(100)
  gazinImageOffsetX: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(100)
  gazinImageOffsetY: number;
}
