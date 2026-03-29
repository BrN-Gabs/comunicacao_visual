import { Module } from '@nestjs/common';
import { AppMailService } from './mail.service';

@Module({
  providers: [AppMailService],
  exports: [AppMailService],
})
export class MailModule {}
