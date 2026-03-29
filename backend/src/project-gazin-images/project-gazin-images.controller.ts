import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProjectGazinImagesService } from './project-gazin-images.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('communications/:communicationId/project-gazin-images')
export class ProjectGazinImagesController {
  constructor(
    private readonly projectGazinImagesService: ProjectGazinImagesService,
  ) {}

  @Post('sync')
  sync(
    @Param('communicationId') communicationId: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
  ) {
    return this.projectGazinImagesService.syncFromLibrary(
      communicationId,
      user,
    );
  }

  @Get()
  findAll(@Param('communicationId') communicationId: string) {
    return this.projectGazinImagesService.findAllByCommunication(
      communicationId,
    );
  }

  @Delete('item/:id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
  ) {
    return this.projectGazinImagesService.remove(id, user);
  }
}
