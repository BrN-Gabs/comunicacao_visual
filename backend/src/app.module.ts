import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { GazinLibraryModule } from './gazin-library/gazin-library.module';
import { CommunicationsModule } from './communications/communications.module';
import { CityImagesModule } from './city-images/city-images.module';
import { ProjectGazinImagesModule } from './project-gazin-images/project-gazin-images.module';
import { FramesModule } from './frames/frames.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { UploadsModule } from './uploads/uploads.module';
import { ExportsModule } from './exports/exports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CityLibraryModule } from './city-library/city-library.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    GazinLibraryModule,
    CommunicationsModule,
    CityImagesModule,
    ProjectGazinImagesModule,
    FramesModule,
    AuditLogsModule,
    UploadsModule,
    ExportsModule,
    DashboardModule,
    CityLibraryModule,
    NotificationsModule,
  ],
})
export class AppModule {}
