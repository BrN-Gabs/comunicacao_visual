import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from './dto/create-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

@Injectable()
export class InitialAdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InitialAdminService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async onApplicationBootstrap() {
    const usersCount = await this.prisma.user.count();

    if (usersCount > 0) {
      return;
    }

    const name = this.configService.get<string>('INITIAL_ADMIN_NAME')?.trim();
    const email = this.configService
      .get<string>('INITIAL_ADMIN_EMAIL')
      ?.trim()
      .toLowerCase();
    const password = this.configService
      .get<string>('INITIAL_ADMIN_PASSWORD')
      ?.trim();

    if (!name || !email || !password) {
      this.logger.warn(
        'Banco vazio, mas as variaveis INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD nao foram configuradas.',
      );
      return;
    }

    await this.usersService.create({
      name,
      email,
      password,
      role: UserRole.ADMIN,
    });

    this.logger.log(`Primeiro usuario ADMIN criado automaticamente para ${email}.`);
  }
}
