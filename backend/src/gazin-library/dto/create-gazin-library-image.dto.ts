import { IsString, IsUrl, MinLength } from 'class-validator';

export class CreateGazinLibraryImageDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsString()
  @MinLength(2)
  description: string;

  @IsUrl()
  imageUrl: string;
}
