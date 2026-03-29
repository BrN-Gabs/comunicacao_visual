import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { FilterCommunicationsDto } from './dto/filter-communications.dto';
import { UpdateCommunicationDto } from './dto/update-communication.dto';
import { DivergeCommunicationDto } from './dto/diverge-communication.dto';
import { AddCommunicationWallDto } from './dto/add-communication-wall.dto';
import { AddCommunicationFrameDto } from './dto/add-communication-frame.dto';

@UseGuards(JwtAuthGuard)
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() data: CreateCommunicationDto,
  ) {
    return this.communicationsService.create(user.id, data);
  }

  @Get()
  findAll(@Query() query: FilterCommunicationsDto) {
    return this.communicationsService.findAll(query);
  }

  @Get(':id/status-history')
  getStatusHistory(@Param('id') id: string) {
    return this.communicationsService.getStatusHistory(id);
  }

  @Get(':id/readiness')
  getReadiness(@Param('id') id: string) {
    return this.communicationsService.getReadiness(id);
  }

  @Get(':id/summary')
  getSummary(@Param('id') id: string) {
    return this.communicationsService.getSummary(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.communicationsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Body() data: UpdateCommunicationDto,
  ) {
    return this.communicationsService.update(id, user, data);
  }

  @Post(':id/walls')
  addWall(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Body() body: AddCommunicationWallDto,
  ) {
    return this.communicationsService.addWall(id, user, body);
  }

  @Post('walls/:wallId/frames')
  addFrame(
    @Param('wallId') wallId: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Body() body: AddCommunicationFrameDto,
  ) {
    return this.communicationsService.addFrame(wallId, user, body);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
  ) {
    return this.communicationsService.remove(id, user);
  }

  @Delete('walls/:wallId')
  removeWall(
    @Param('wallId') wallId: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
  ) {
    return this.communicationsService.removeWall(wallId, user);
  }

  @Post(':id/finalize')
  finalize(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
  ) {
    return this.communicationsService.finalize(id, user);
  }

  @Post(':id/validate')
  validateCommunication(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
  ) {
    return this.communicationsService.validateCommunication(id, user);
  }

  @Post(':id/diverge')
  divergeCommunication(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Body() body: DivergeCommunicationDto,
  ) {
    return this.communicationsService.divergeCommunication(
      id,
      user,
      body.comment,
    );
  }

  @Post(':id/assign-images')
  assignImages(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
  ) {
    return this.communicationsService.assignImages(id, user);
  }
}
