import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CityLibraryController } from './city-library.controller';
import { CityLibraryService } from './city-library.service';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [CityLibraryController],
  providers: [CityLibraryService],
  exports: [CityLibraryService],
})
export class CityLibraryModule {}
