import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('recent')
  getRecent(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit);

    return this.notificationsService.getRecent(
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }
}
