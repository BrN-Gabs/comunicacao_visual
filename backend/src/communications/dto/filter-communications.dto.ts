import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum CommunicationStatusFilterDto {
  IN_PROGRESS = 'IN_PROGRESS',
  FINALIZED = 'FINALIZED',
  DIVERGENT = 'DIVERGENT',
  VALIDATED = 'VALIDATED',
}

export class FilterCommunicationsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  cityName?: string;

  @IsOptional()
  @IsString()
  createdByName?: string;

  @IsOptional()
  @IsEnum(CommunicationStatusFilterDto)
  status?: CommunicationStatusFilterDto;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  limit?: number = 10;
}
