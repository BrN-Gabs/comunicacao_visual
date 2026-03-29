import { IsString, MaxLength } from 'class-validator';

export class CreateCityLibraryCityDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsString()
  @MaxLength(2)
  state: string;
}
