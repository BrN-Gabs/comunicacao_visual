import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { InitialAdminService } from './initial-admin.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [UsersController],
  providers: [UsersService, InitialAdminService],
  exports: [UsersService],
})
export class UsersModule {}
