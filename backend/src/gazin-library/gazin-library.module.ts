import { Module } from '@nestjs/common';
import { GazinLibraryController } from './gazin-library.controller';
import { GazinLibraryService } from './gazin-library.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [GazinLibraryController],
  providers: [GazinLibraryService],
  exports: [GazinLibraryService],
})
export class GazinLibraryModule {}
