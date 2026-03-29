import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(6, {
    message: 'A senha deve ter no minimo 6 caracteres.',
  })
  @Matches(/[^A-Za-z0-9\s]/, {
    message: 'A senha deve conter pelo menos 1 caractere especial.',
  })
  password: string;
}
