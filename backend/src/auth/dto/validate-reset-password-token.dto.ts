import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateResetPasswordTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
