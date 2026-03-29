import { IsString, MaxLength } from 'class-validator';

export class AddCommunicationWallDto {
  @IsString()
  @MaxLength(100)
  name: string;
}
