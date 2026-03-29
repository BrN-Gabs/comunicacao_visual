import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FramesService } from './frames.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SwapCityImageDto } from './dto/swap-city-image.dto';
import { SwapGazinImageDto } from './dto/swap-gazin-image.dto';
import { UpdateFrameDimensionsDto } from './dto/update-frame-dimensions.dto';
import { UpdateFrameImageLayoutDto } from './dto/update-frame-image-layout.dto';

@UseGuards(JwtAuthGuard)
@Controller('frames')
export class FramesController {
  constructor(private readonly framesService: FramesService) {}

  @Post(':id/swap-city-image')
  swapCityImage(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Body() body: SwapCityImageDto,
  ) {
    return this.framesService.swapCityImage(
      id,
      user,
      body.targetProjectCityImageId,
    );
  }

  @Post(':id/swap-gazin-image')
  swapGazinImage(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Body() body: SwapGazinImageDto,
  ) {
    return this.framesService.swapGazinImage(
      id,
      user,
      body.targetProjectGazinImageId,
    );
  }

  @Patch(':id/dimensions')
  updateDimensions(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Body() body: UpdateFrameDimensionsDto,
  ) {
    return this.framesService.updateDimensions(
      id,
      user,
      body.widthM,
      body.heightM,
    );
  }

  @Patch(':id/image-layout')
  updateImageLayout(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Body() body: UpdateFrameImageLayoutDto,
  ) {
    return this.framesService.updateImageLayout(id, user, body);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
  ) {
    return this.framesService.remove(id, user);
  }
}
