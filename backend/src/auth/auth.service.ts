import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { compare, hash } from 'bcrypt';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AppMailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type PasswordResetPayload = {
  sub: string;
  type: 'password-reset';
};

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_BASE_LOCK_MINUTES = 30;
const LOGIN_MAX_LOCK_MINUTES = 24 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditLogsService: AuditLogsService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mailService: AppMailService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    if (user.status === 'INACTIVE') {
      throw new UnauthorizedException('Usuario inativo');
    }

    const now = new Date();

    if (this.isLoginLocked(user.loginLockedUntil, now)) {
      await this.auditLogsService.create({
        userId: user.id,
        module: 'AUTH',
        action: 'LOGIN_BLOCKED',
        entityType: 'USER',
        entityId: user.id,
        entityLabel: user.name,
        description: 'Tentativa de login bloqueada por excesso de falhas',
        metadata: {
          email: user.email,
          lockedUntil: user.loginLockedUntil?.toISOString() ?? null,
          remainingMinutes: this.getRemainingLockMinutes(
            user.loginLockedUntil,
            now,
          ),
          loginLockLevel: user.loginLockLevel,
        },
      });

      throw new UnauthorizedException(
        this.buildLoginLockedMessage(user.loginLockedUntil, now),
      );
    }

    const passwordMatch = await compare(password, user.passwordHash);

    if (!passwordMatch) {
      await this.registerFailedLogin(user, now);
    }

    if (this.shouldResetLoginLockState(user)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          loginLockLevel: 0,
          loginLockedUntil: null,
        },
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async requestPasswordRecovery(email: string) {
    this.mailService.assertConfigured();

    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (user) {
      const resetToken = this.jwtService.sign(
        {
          sub: user.id,
          type: 'password-reset',
        } satisfies PasswordResetPayload,
        {
          secret: this.buildPasswordResetSecret(user.passwordHash),
          expiresIn: this.getPasswordResetExpiresIn(),
        },
      );
      const resetUrl = this.buildPasswordResetUrl(resetToken);

      await this.mailService.sendPasswordResetEmail({
        to: user.email,
        userName: user.name,
        resetUrl,
        expiresInLabel: this.getPasswordResetExpiresInLabel(),
      });

      await this.auditLogsService.create({
        userId: user.id,
        module: 'AUTH',
        action: 'FORGOT_PASSWORD',
        entityType: 'USER',
        entityId: user.id,
        entityLabel: user.name,
        description: 'Solicitacao de recuperacao de senha enviada por e-mail',
        metadata: {
          email: user.email,
          status: user.status,
          resetExpiresIn: this.getPasswordResetExpiresIn(),
        },
      });
    }

    return {
      message:
        'Se o e-mail estiver cadastrado, voce recebera um link para redefinir a senha.',
    };
  }

  async validatePasswordResetToken(token: string) {
    const user = await this.getUserFromPasswordResetToken(token);

    return {
      message: 'Token de redefinicao valido.',
      user: {
        name: user.name,
        email: user.email,
      },
    };
  }

  async resetPassword(token: string, password: string) {
    const user = await this.getUserFromPasswordResetToken(token);
    const isSamePassword = await compare(password, user.passwordHash);

    if (isSamePassword) {
      throw new BadRequestException(
        'A nova senha nao pode ser igual a senha atual.',
      );
    }

    const passwordHash = await hash(password, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        loginLockLevel: 0,
        loginLockedUntil: null,
      },
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'AUTH',
      action: 'RESET_PASSWORD',
      entityType: 'USER',
      entityId: user.id,
      entityLabel: user.name,
      description: 'Senha redefinida com sucesso via link de recuperacao',
      metadata: {
        email: user.email,
      },
    });

    return {
      message: 'Senha redefinida com sucesso.',
    };
  }

  private async getUserFromPasswordResetToken(token: string) {
    const normalizedToken = token.trim();
    const decoded: unknown = this.jwtService.decode(normalizedToken);

    if (!decoded || typeof decoded !== 'object') {
      throw new BadRequestException(
        'Link de redefinicao invalido ou expirado.',
      );
    }

    const payload = decoded as Partial<PasswordResetPayload>;

    if (payload.type !== 'password-reset' || typeof payload.sub !== 'string') {
      throw new BadRequestException(
        'Link de redefinicao invalido ou expirado.',
      );
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new BadRequestException(
        'Link de redefinicao invalido ou expirado.',
      );
    }

    try {
      this.jwtService.verify(normalizedToken, {
        secret: this.buildPasswordResetSecret(user.passwordHash),
      });
    } catch {
      throw new BadRequestException(
        'Link de redefinicao invalido ou expirado.',
      );
    }

    return user;
  }

  private buildPasswordResetSecret(passwordHash: string) {
    const baseSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    return `${baseSecret}:${passwordHash}`;
  }

  private async registerFailedLogin(
    user: {
      id: string;
      name: string;
      email: string;
      failedLoginAttempts: number;
      loginLockLevel: number;
      loginLockedUntil: Date | null;
    },
    now: Date,
  ) {
    const nextFailedLoginAttempts = user.failedLoginAttempts + 1;

    if (nextFailedLoginAttempts < LOGIN_MAX_ATTEMPTS) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: nextFailedLoginAttempts,
          ...(user.loginLockedUntil ? { loginLockedUntil: null } : {}),
        },
      });

      throw new UnauthorizedException('Credenciais invalidas');
    }

    const nextLockLevel = user.loginLockLevel + 1;
    const lockDurationMinutes = this.getLockDurationMinutes(nextLockLevel);
    const loginLockedUntil = new Date(
      now.getTime() + lockDurationMinutes * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        loginLockLevel: nextLockLevel,
        loginLockedUntil,
      },
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'AUTH',
      action: 'LOGIN_LOCKED',
      entityType: 'USER',
      entityId: user.id,
      entityLabel: user.name,
      description: 'Usuario bloqueado temporariamente por excesso de falhas',
      metadata: {
        email: user.email,
        failedAttemptsThreshold: LOGIN_MAX_ATTEMPTS,
        lockDurationMinutes,
        loginLockLevel: nextLockLevel,
        lockedUntil: loginLockedUntil.toISOString(),
      },
    });

    throw new UnauthorizedException(
      this.buildLoginLockedMessage(loginLockedUntil, now),
    );
  }

  private shouldResetLoginLockState(user: {
    failedLoginAttempts: number;
    loginLockLevel: number;
    loginLockedUntil: Date | null;
  }) {
    return (
      user.failedLoginAttempts > 0 ||
      user.loginLockLevel > 0 ||
      user.loginLockedUntil !== null
    );
  }

  private isLoginLocked(loginLockedUntil: Date | null, now: Date) {
    return Boolean(
      loginLockedUntil && loginLockedUntil.getTime() > now.getTime(),
    );
  }

  private getLockDurationMinutes(loginLockLevel: number) {
    const durationMinutes =
      LOGIN_BASE_LOCK_MINUTES * 2 ** Math.max(loginLockLevel - 1, 0);

    return Math.min(durationMinutes, LOGIN_MAX_LOCK_MINUTES);
  }

  private getRemainingLockMinutes(loginLockedUntil: Date | null, now: Date) {
    if (!loginLockedUntil) {
      return 0;
    }

    return Math.max(
      Math.ceil((loginLockedUntil.getTime() - now.getTime()) / (60 * 1000)),
      1,
    );
  }

  private buildLoginLockedMessage(loginLockedUntil: Date | null, now: Date) {
    const remainingMinutes = this.getRemainingLockMinutes(
      loginLockedUntil,
      now,
    );

    return `Muitas tentativas invalidas. Tente novamente em ${this.formatMinutes(
      remainingMinutes,
    )}.`;
  }

  private formatMinutes(totalMinutes: number) {
    if (totalMinutes < 60) {
      return `${totalMinutes} minuto${totalMinutes === 1 ? '' : 's'}`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) {
      return `${hours} hora${hours === 1 ? '' : 's'}`;
    }

    return `${hours} hora${hours === 1 ? '' : 's'} e ${minutes} minuto${
      minutes === 1 ? '' : 's'
    }`;
  }

  private getPasswordResetExpiresIn(): StringValue {
    return (this.configService.get<string>('PASSWORD_RESET_EXPIRES_IN') ??
      '1h') as StringValue;
  }

  private getPasswordResetExpiresInLabel() {
    const value = this.getPasswordResetExpiresIn().trim();
    const match = value.match(/^(\d+)\s*([mhd])$/i);

    if (!match) {
      return value;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === 'm') {
      return `${amount} minuto${amount === 1 ? '' : 's'}`;
    }

    if (unit === 'h') {
      return `${amount} hora${amount === 1 ? '' : 's'}`;
    }

    return `${amount} dia${amount === 1 ? '' : 's'}`;
  }

  private buildPasswordResetUrl(token: string) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    const resetUrl = new URL('/reset-password', frontendUrl);

    resetUrl.searchParams.set('token', token);

    return resetUrl.toString();
  }
}
