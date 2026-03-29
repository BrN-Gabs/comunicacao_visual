import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;

  const dashboardService = {
    getStatusByUser: jest.fn(),
    getRecentExports: jest.fn(),
    clearRecentExports: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: dashboardService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return the aggregated dashboard data', async () => {
    const expected = {
      userStatus: [
        {
          userId: 'user-1',
          name: 'Bruno',
          role: 'ADMIN',
          finalizedCount: 2,
          openCount: 3,
        },
      ],
    };

    dashboardService.getStatusByUser.mockResolvedValue(expected);

    await expect(controller.getStatusByUser()).resolves.toEqual(expected);
    expect(dashboardService.getStatusByUser).toHaveBeenCalledTimes(1);
  });

  it('should return recent exports', async () => {
    const expected = {
      recentExports: [
        {
          id: 'log-1',
          action: 'EXPORT_FRAME_JPG',
        },
      ],
    };

    dashboardService.getRecentExports.mockResolvedValue(expected);

    await expect(controller.getRecentExports()).resolves.toEqual(expected);
    expect(dashboardService.getRecentExports).toHaveBeenCalledTimes(1);
  });

  it('should clear recent exports for admin', async () => {
    const expected = {
      message: 'Exportacoes recentes removidas com sucesso',
      deletedCount: 2,
    };

    dashboardService.clearRecentExports.mockResolvedValue(expected);

    await expect(
      controller.clearRecentExports({ id: 'admin-1' }),
    ).resolves.toEqual(expected);
    expect(dashboardService.clearRecentExports).toHaveBeenCalledWith('admin-1');
  });
});
