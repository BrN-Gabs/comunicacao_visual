import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ExportsService } from './exports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

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

  @Get('frames/:id/jpg')
  async exportFrameJpg(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Res() res: Response,
  ) {
    const file = await this.exportsService.exportFrameJpg(id, user);

    this.setDownloadHeaders(res, file);

    return res.send(file.buffer);
  }

  @Get('frames/:id/pdf')
  async exportFramePdf(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Res() res: Response,
  ) {
    const file = await this.exportsService.exportFramePdf(id, user);

    this.setDownloadHeaders(res, file);

    return res.send(file.buffer);
  }

  @Get('communications/:id/jpg-zip')
  async exportCommunicationJpgZip(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Res() res: Response,
  ) {
    const file = await this.exportsService.exportCommunicationJpgZip(id, user);

    this.setDownloadHeaders(res, file);

    return res.send(file.buffer);
  }

  @Get('communications/:id/pdf')
  async exportCommunicationPdf(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Res() res: Response,
  ) {
    const file = await this.exportsService.exportCommunicationPdf(id, user);

    this.setDownloadHeaders(res, file);

    return res.send(file.buffer);
  }

  @Get('communications/:id/pdf-zip')
  async exportCommunicationPdfZip(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Res() res: Response,
  ) {
    const file = await this.exportsService.exportCommunicationPdfZip(id, user);

    this.setDownloadHeaders(res, file);

    return res.send(file.buffer);
  }
}
