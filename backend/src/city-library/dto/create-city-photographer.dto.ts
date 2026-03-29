import { IsString, MaxLength } from 'class-validator';

export class CreateCityPhotographerDto {
  @IsString()
  @MaxLength(150)
  name: string;
}
