import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum GazinImageStatusFilterDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class FilterGazinLibraryImagesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(GazinImageStatusFilterDto)
  status?: GazinImageStatusFilterDto;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  limit?: number = 10;
}
