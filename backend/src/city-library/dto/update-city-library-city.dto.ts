import { IsString, MaxLength } from 'class-validator';

export class UpdateCityLibraryCityDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsString()
  @MaxLength(2)
  state: string;
}
