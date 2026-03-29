import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
    login: jest.fn(),
    requestPasswordRecovery: jest.fn(),
    validatePasswordResetToken: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate forgot password requests to the service', async () => {
    authService.requestPasswordRecovery.mockResolvedValue({
      message: 'ok',
    });

    await expect(
      controller.forgotPassword({ email: 'ana@gazin.com.br' }),
    ).resolves.toEqual({
      message: 'ok',
    });

    expect(authService.requestPasswordRecovery).toHaveBeenCalledWith(
      'ana@gazin.com.br',
    );
  });

  it('should delegate password reset to the service', async () => {
    authService.resetPassword.mockResolvedValue({
      message: 'Senha redefinida com sucesso.',
    });

    await expect(
      controller.resetPassword({
        token: 'reset-token',
        password: 'Nova@123',
      }),
    ).resolves.toEqual({
      message: 'Senha redefinida com sucesso.',
    });

    expect(authService.resetPassword).toHaveBeenCalledWith(
      'reset-token',
      'Nova@123',
    );
  });
});
