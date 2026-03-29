import { Test, TestingModule } from '@nestjs/testing';
import { compare, hash } from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AppMailService } from '../mail/mail.service';

describe('AuthService', () => {
  let service: AuthService;

  const usersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
  };

  const jwtService = {
    sign: jest.fn(),
    decode: jest.fn(),
    verify: jest.fn(),
  };

  const auditLogsService = {
    create: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'PASSWORD_RESET_EXPIRES_IN') {
        return '2h';
      }

      if (key === 'FRONTEND_URL') {
        return 'http://localhost:3001';
      }

      return undefined;
    }),
    getOrThrow: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') {
        return 'test-secret';
      }

      throw new Error(`Missing config for ${key}`);
    }),
  };

  const prisma = {
    user: {
      update: jest.fn(),
    },
  };

  const mailService = {
    assertConfigured: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: AuditLogsService,
          useValue: auditLogsService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AppMailService,
          useValue: mailService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should login with valid credentials and clear any previous lock state', async () => {
    const passwordHash = await hash('Senha@123', 10);

    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@gazin.com.br',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash,
      failedLoginAttempts: 2,
      loginLockLevel: 1,
      loginLockedUntil: new Date(0),
    });
    jwtService.sign.mockReturnValue('access-token');

    await expect(
      service.login('ana@gazin.com.br', 'Senha@123'),
    ).resolves.toEqual({
      accessToken: 'access-token',
      user: {
        id: 'user-1',
        name: 'Ana',
        email: 'ana@gazin.com.br',
        role: 'ADMIN',
      },
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        failedLoginAttempts: 0,
        loginLockLevel: 0,
        loginLockedUntil: null,
      },
    });
  });

  it('should increment failed attempts after an invalid password', async () => {
    const passwordHash = await hash('Senha@123', 10);

    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@gazin.com.br',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash,
      failedLoginAttempts: 0,
      loginLockLevel: 0,
      loginLockedUntil: null,
    });

    await expect(
      service.login('ana@gazin.com.br', 'Senha@999'),
    ).rejects.toThrow('Credenciais invalidas');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        failedLoginAttempts: 1,
      },
    });
    expect(auditLogsService.create).not.toHaveBeenCalled();
  });

  it('should lock the user for 30 minutes after the fifth invalid attempt', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T12:00:00.000Z'));

    const passwordHash = await hash('Senha@123', 10);

    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@gazin.com.br',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash,
      failedLoginAttempts: 4,
      loginLockLevel: 0,
      loginLockedUntil: null,
    });

    await expect(
      service.login('ana@gazin.com.br', 'Senha@999'),
    ).rejects.toThrow(
      'Muitas tentativas invalidas. Tente novamente em 30 minutos.',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        failedLoginAttempts: 0,
        loginLockLevel: 1,
        loginLockedUntil: new Date('2026-03-28T12:30:00.000Z'),
      },
    });
    const [lockAuditPayload] = auditLogsService.create.mock.calls[0] as [
      {
        action: string;
        metadata: {
          email: string;
          failedAttemptsThreshold: number;
          lockDurationMinutes: number;
          loginLockLevel: number;
        };
      },
    ];

    expect(lockAuditPayload.action).toBe('LOGIN_LOCKED');
    expect(lockAuditPayload.metadata).toMatchObject({
      email: 'ana@gazin.com.br',
      failedAttemptsThreshold: 5,
      lockDurationMinutes: 30,
      loginLockLevel: 1,
    });
  });

  it('should increase the lock duration after repeated lock cycles', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T12:00:00.000Z'));

    const passwordHash = await hash('Senha@123', 10);

    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@gazin.com.br',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash,
      failedLoginAttempts: 4,
      loginLockLevel: 1,
      loginLockedUntil: null,
    });

    await expect(
      service.login('ana@gazin.com.br', 'Senha@999'),
    ).rejects.toThrow(
      'Muitas tentativas invalidas. Tente novamente em 1 hora.',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        failedLoginAttempts: 0,
        loginLockLevel: 2,
        loginLockedUntil: new Date('2026-03-28T13:00:00.000Z'),
      },
    });
  });

  it('should reject login attempts while the user is locked', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T12:00:00.000Z'));

    const passwordHash = await hash('Senha@123', 10);

    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@gazin.com.br',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash,
      failedLoginAttempts: 0,
      loginLockLevel: 2,
      loginLockedUntil: new Date('2026-03-28T12:45:00.000Z'),
    });

    await expect(
      service.login('ana@gazin.com.br', 'Senha@123'),
    ).rejects.toThrow(
      'Muitas tentativas invalidas. Tente novamente em 45 minutos.',
    );

    expect(prisma.user.update).not.toHaveBeenCalled();
    const [blockedAuditPayload] = auditLogsService.create.mock.calls[0] as [
      {
        action: string;
        metadata: {
          email: string;
          remainingMinutes: number;
          loginLockLevel: number;
        };
      },
    ];

    expect(blockedAuditPayload.action).toBe('LOGIN_BLOCKED');
    expect(blockedAuditPayload.metadata).toMatchObject({
      email: 'ana@gazin.com.br',
      remainingMinutes: 45,
      loginLockLevel: 2,
    });
  });

  it('should send a password reset email when the user exists', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@gazin.com.br',
      status: 'ACTIVE',
      passwordHash: 'stored-hash',
    });
    jwtService.sign.mockReturnValue('reset-token');

    await expect(
      service.requestPasswordRecovery('ANA@GAZIN.COM.BR'),
    ).resolves.toEqual({
      message:
        'Se o e-mail estiver cadastrado, voce recebera um link para redefinir a senha.',
    });

    expect(mailService.assertConfigured).toHaveBeenCalledTimes(1);
    expect(jwtService.sign).toHaveBeenCalledWith(
      {
        sub: 'user-1',
        type: 'password-reset',
      },
      {
        secret: 'test-secret:stored-hash',
        expiresIn: '2h',
      },
    );
    expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith({
      to: 'ana@gazin.com.br',
      userName: 'Ana',
      resetUrl: 'http://localhost:3001/reset-password?token=reset-token',
      expiresInLabel: '2 horas',
    });
    expect(auditLogsService.create).toHaveBeenCalledTimes(1);
  });

  it('should validate a password reset token', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@gazin.com.br',
      passwordHash: 'stored-hash',
    });
    jwtService.decode.mockReturnValue({
      sub: 'user-1',
      type: 'password-reset',
    });

    await expect(
      service.validatePasswordResetToken('reset-token'),
    ).resolves.toEqual({
      message: 'Token de redefinicao valido.',
      user: {
        name: 'Ana',
        email: 'ana@gazin.com.br',
      },
    });

    expect(jwtService.verify).toHaveBeenCalledWith('reset-token', {
      secret: 'test-secret:stored-hash',
    });
  });

  it('should update the password from a valid recovery link', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@gazin.com.br',
      passwordHash: 'stored-hash',
    });
    jwtService.decode.mockReturnValue({
      sub: 'user-1',
      type: 'password-reset',
    });

    await expect(
      service.resetPassword('reset-token', 'Nova@123'),
    ).resolves.toEqual({
      message: 'Senha redefinida com sucesso.',
    });

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(auditLogsService.create).toHaveBeenCalledTimes(1);

    const updateMock = prisma.user.update;
    const [updatePayload] = updateMock.mock.calls[0] as [
      {
        where: { id: string };
        data: {
          passwordHash: string;
          failedLoginAttempts: number;
          loginLockLevel: number;
          loginLockedUntil: null;
        };
      },
    ];

    expect(updatePayload.where).toEqual({ id: 'user-1' });
    expect(await compare('Nova@123', updatePayload.data.passwordHash)).toBe(
      true,
    );
    expect(updatePayload.data.failedLoginAttempts).toBe(0);
    expect(updatePayload.data.loginLockLevel).toBe(0);
    expect(updatePayload.data.loginLockedUntil).toBeNull();
  });

  it('should reject when the new password matches the current one', async () => {
    const passwordHash = await hash('Mesma@123', 10);

    usersService.findById.mockResolvedValue({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@gazin.com.br',
      passwordHash,
    });
    jwtService.decode.mockReturnValue({
      sub: 'user-1',
      type: 'password-reset',
    });

    await expect(
      service.resetPassword('reset-token', 'Mesma@123'),
    ).rejects.toThrow('A nova senha nao pode ser igual a senha atual.');

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(auditLogsService.create).not.toHaveBeenCalled();
  });
});
