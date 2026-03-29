import { Module } from '@nestjs/common';
import { ProjectGazinImagesController } from './project-gazin-images.controller';
import { ProjectGazinImagesService } from './project-gazin-images.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [ProjectGazinImagesController],
  providers: [ProjectGazinImagesService],
  exports: [ProjectGazinImagesService],
})
export class ProjectGazinImagesModule {}
