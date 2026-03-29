import { IsString, MaxLength } from 'class-validator';

export class UpdateCityPhotographerDto {
  @IsString()
  @MaxLength(150)
  name: string;
}
