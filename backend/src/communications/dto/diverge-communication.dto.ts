import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DivergeCommunicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  comment: string;
}
