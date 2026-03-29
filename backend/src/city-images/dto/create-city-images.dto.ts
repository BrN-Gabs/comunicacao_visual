import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateCityImageItemDto {
  @IsUrl()
  imageUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsString()
  @MaxLength(255)
  authorName: string;
}

export class CreateCityImagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCityImageItemDto)
  images: CreateCityImageItemDto[];
}
