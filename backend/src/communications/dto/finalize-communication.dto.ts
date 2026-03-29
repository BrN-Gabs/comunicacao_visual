import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FinalizeCommunicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
