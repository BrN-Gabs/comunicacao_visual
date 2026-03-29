import { IsEnum } from 'class-validator';

export enum UserStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatusDto)
  status: UserStatusDto;
}
