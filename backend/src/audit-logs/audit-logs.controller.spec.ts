import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsController', () => {
  let controller: AuditLogsController;

  const auditLogsService = {
    findAll: jest.fn(),
    getFilterOptions: jest.fn(),
    getMonthlySummary: jest.fn(),
    exportFilteredCsv: jest.fn(),
    exportMonthlySummaryCsv: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [
        {
          provide: AuditLogsService,
          useValue: auditLogsService,
        },
      ],
    }).compile();

    controller = module.get<AuditLogsController>(AuditLogsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate listing logs to the service', async () => {
    const expected = {
      items: [],
      meta: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      },
    };
    auditLogsService.findAll.mockResolvedValue(expected);

    await expect(controller.findAll({ page: 1, limit: 20 })).resolves.toEqual(
      expected,
    );
    expect(auditLogsService.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it('should delegate filter options to the service', async () => {
    const expected = {
      modules: ['COMMUNICATIONS'],
      actions: ['CREATE'],
      entityTypes: ['COMMUNICATION'],
      users: [],
      dateRange: {
        oldestAt: null,
        newestAt: null,
      },
    };
    auditLogsService.getFilterOptions.mockResolvedValue(expected);

    await expect(controller.getFilterOptions()).resolves.toEqual(expected);
    expect(auditLogsService.getFilterOptions).toHaveBeenCalledTimes(1);
  });
});
