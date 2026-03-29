import { Module } from '@nestjs/common';
import { CityImagesController } from './city-images.controller';
import { CityImagesService } from './city-images.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [CityImagesController],
  providers: [CityImagesService],
  exports: [CityImagesService],
})
export class CityImagesModule {}
