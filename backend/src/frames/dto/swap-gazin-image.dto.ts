import { IsString } from 'class-validator';

export class SwapGazinImageDto {
  @IsString()
  targetProjectGazinImageId: string;
}
