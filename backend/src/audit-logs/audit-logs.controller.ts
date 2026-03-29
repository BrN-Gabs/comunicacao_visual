import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FilterAuditLogsDto } from './dto/filter-audit-logs.dto';
import { MonthlySummaryDto } from './dto/monthly-summary.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  private setDownloadHeaders(
    res: Response,
    file: { mimeType: string; fileName: string },
  ) {
    const encodedFileName = encodeURIComponent(file.fileName);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"; filename*=UTF-8''${encodedFileName}`,
    );
  }

  @Get('filter-options')
  getFilterOptions() {
    return this.auditLogsService.getFilterOptions();
  }

  @Get('report.csv')
  async exportFilteredReport(
    @Query() query: FilterAuditLogsDto,
    @Res() res: Response,
  ) {
    const file = await this.auditLogsService.exportFilteredCsv(query);

    this.setDownloadHeaders(res, file);

    return res.send(file.buffer);
  }

  @Get('monthly-summary/report.csv')
  async exportMonthlySummaryReport(
    @Query() query: MonthlySummaryDto,
    @Res() res: Response,
  ) {
    const file = await this.auditLogsService.exportMonthlySummaryCsv(
      query.year,
      query.month,
    );

    this.setDownloadHeaders(res, file);

    return res.send(file.buffer);
  }

  @Get()
  findAll(@Query() query: FilterAuditLogsDto) {
    return this.auditLogsService.findAll(query);
  }

  @Get('monthly-summary')
  getMonthlySummary(@Query() query: MonthlySummaryDto) {
    return this.auditLogsService.getMonthlySummary(query.year, query.month);
  }
}
