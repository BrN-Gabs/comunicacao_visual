import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export enum UserRoleFilterDto {
  ADMIN = 'ADMIN',
  VIP = 'VIP',
  NORMAL = 'NORMAL',
}

export enum UserStatusFilterDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class FilterUsersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserRoleFilterDto)
  role?: UserRoleFilterDto;

  @IsOptional()
  @IsEnum(UserStatusFilterDto)
  status?: UserStatusFilterDto;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  limit?: number = 10;
}
