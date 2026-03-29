import { IsEnum } from 'class-validator';

export enum GazinImageStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class UpdateGazinLibraryImageStatusDto {
  @IsEnum(GazinImageStatusDto)
  status: GazinImageStatusDto;
}
