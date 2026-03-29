import { Module } from '@nestjs/common';
import { FramesController } from './frames.controller';
import { FramesService } from './frames.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [FramesController],
  providers: [FramesService],
  exports: [FramesService],
})
export class FramesModule {}
