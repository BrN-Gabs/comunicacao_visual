import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class AddCommunicationFrameDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsNumber()
  @Min(0.01)
  widthM: number;

  @IsNumber()
  @Min(0.01)
  heightM: number;
}
