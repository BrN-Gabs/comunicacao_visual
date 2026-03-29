import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class UpdateGazinLibraryImageDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  description?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
