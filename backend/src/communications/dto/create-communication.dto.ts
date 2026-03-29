import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateFrameDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsNumber()
  @Min(1)
  order: number;

  @IsNumber()
  @Min(0.01)
  widthM: number;

  @IsNumber()
  @Min(0.01)
  heightM: number;
}

class CreateWallDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsNumber()
  @Min(1)
  order: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateFrameDto)
  frames: CreateFrameDto[];
}

export class CreateCommunicationDto {
  @IsString()
  @MaxLength(150)
  storeName: string;

  @IsString()
  cityLibraryId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateWallDto)
  walls: CreateWallDto[];
}
