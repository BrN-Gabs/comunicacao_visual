import { Controller, Delete, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('status-by-user')
  getStatusByUser() {
    return this.dashboardService.getStatusByUser();
  }

  @Get('recent-exports')
  getRecentExports() {
    return this.dashboardService.getRecentExports();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete('recent-exports')
  clearRecentExports(@CurrentUser() user: { id: string }) {
    return this.dashboardService.clearRecentExports(user.id);
  }
}
