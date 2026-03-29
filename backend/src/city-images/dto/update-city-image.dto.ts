import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateCityImageDto {
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  authorName?: string;
}
