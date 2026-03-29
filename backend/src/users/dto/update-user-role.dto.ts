import { IsEnum } from 'class-validator';

export enum UserRoleDto {
  ADMIN = 'ADMIN',
  VIP = 'VIP',
  NORMAL = 'NORMAL',
}

export class UpdateUserRoleDto {
  @IsEnum(UserRoleDto)
  role: UserRoleDto;
}
