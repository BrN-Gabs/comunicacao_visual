import { IsNumber, Min } from 'class-validator';

export class UpdateFrameDimensionsDto {
  @IsNumber()
  @Min(0.01)
  widthM: number;

  @IsNumber()
  @Min(0.01)
  heightM: number;
}
