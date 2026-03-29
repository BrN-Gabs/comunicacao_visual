import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { UserRole } from './create-user.dto';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, {
    message: 'A senha deve ter no minimo 6 caracteres.',
  })
  @Matches(/[^A-Za-z0-9\s]/, {
    message: 'A senha deve conter pelo menos 1 caractere especial.',
  })
  password?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
