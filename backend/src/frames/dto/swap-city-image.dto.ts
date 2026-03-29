import { IsString } from 'class-validator';

export class SwapCityImageDto {
  @IsString()
  targetProjectCityImageId: string;
}
