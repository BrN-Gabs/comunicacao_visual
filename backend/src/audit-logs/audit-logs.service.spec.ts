import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService', () => {
  let service: AuditLogsService;

  const prismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return paginated normalized audit logs', async () => {
    prismaService.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        module: 'COMMUNICATIONS',
        action: 'DIVERGE',
        entityType: 'COMMUNICATION',
        entityId: 'comm-1',
        entityLabel: 'Filial 2, Porto Velho - RO',
        description: 'ComunicaÃ§Ã£o marcada como divergente',
        metadata: {
          comment: 'Corrigir a comunicaÃ§Ã£o',
        },
        createdAt: new Date('2026-03-29T14:00:00.000Z'),
        user: {
          id: 'user-1',
          name: 'Bruno',
          email: 'bruno@example.com',
          role: 'ADMIN',
        },
      },
    ]);
    prismaService.auditLog.count.mockResolvedValue(1);

    await expect(
      service.findAll({
        search: 'porto velho',
        page: 1,
        limit: 20,
      }),
    ).resolves.toEqual({
      items: [
        {
          id: 'log-1',
          module: 'COMMUNICATIONS',
          action: 'DIVERGE',
          entityType: 'COMMUNICATION',
          entityId: 'comm-1',
          entityLabel: 'Filial 2, Porto Velho - RO',
          description: 'Comunicação marcada como divergente',
          metadata: {
            comment: 'Corrigir a comunicação',
          },
          createdAt: new Date('2026-03-29T14:00:00.000Z'),
          user: {
            id: 'user-1',
            name: 'Bruno',
            email: 'bruno@example.com',
            role: 'ADMIN',
          },
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    });

    const findManyCalls = prismaService.auditLog.findMany.mock.calls as Array<
      [
        {
          where: {
            OR?: unknown[];
          };
          skip: number;
          take: number;
        },
      ]
    >;
    const firstFindManyArgs = findManyCalls[0]?.[0];

    expect(firstFindManyArgs).toBeDefined();
    expect(firstFindManyArgs?.skip).toBe(0);
    expect(firstFindManyArgs?.take).toBe(20);
    expect(Array.isArray(firstFindManyArgs?.where.OR)).toBe(true);
  });

  it('should return filter options from audit logs and users', async () => {
    prismaService.auditLog.findMany
      .mockResolvedValueOnce([{ module: 'AUTH' }, { module: 'COMMUNICATIONS' }])
      .mockResolvedValueOnce([{ action: 'CREATE' }, { action: 'DELETE' }])
      .mockResolvedValueOnce([
        { entityType: 'COMMUNICATION' },
        { entityType: 'USER' },
      ]);
    prismaService.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        name: 'Amanda',
        email: 'amanda@example.com',
        role: 'ADMIN',
      },
    ]);
    prismaService.auditLog.findFirst
      .mockResolvedValueOnce({
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        createdAt: new Date('2026-03-29T23:00:00.000Z'),
      });

    await expect(service.getFilterOptions()).resolves.toEqual({
      modules: ['AUTH', 'COMMUNICATIONS'],
      actions: ['CREATE', 'DELETE'],
      entityTypes: ['COMMUNICATION', 'USER'],
      users: [
        {
          id: 'user-1',
          name: 'Amanda',
          email: 'amanda@example.com',
          role: 'ADMIN',
        },
      ],
      dateRange: {
        oldestAt: new Date('2026-03-01T00:00:00.000Z'),
        newestAt: new Date('2026-03-29T23:00:00.000Z'),
      },
    });
  });

  it('should export a csv report with BOM and normalized values', async () => {
    prismaService.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        module: 'COMMUNICATIONS',
        action: 'DIVERGE',
        entityType: 'COMMUNICATION',
        entityId: 'comm-1',
        entityLabel: 'Filial 2, Porto Velho - RO',
        description: 'ComunicaÃ§Ã£o marcada como divergente',
        metadata: {
          comment: 'Corrigir a comunicaÃ§Ã£o',
        },
        createdAt: new Date('2026-03-29T14:00:00.000Z'),
        user: {
          id: 'user-1',
          name: 'Bruno',
          email: 'bruno@example.com',
          role: 'ADMIN',
        },
      },
    ]);

    const result = await service.exportFilteredCsv({
      module: 'COMMUNICATIONS',
    });

    expect(result.mimeType).toBe('text/csv; charset=utf-8');
    expect(result.fileName).toContain('relatorio-logs-');
    expect(result.buffer.toString('utf8')).toContain(
      'Comunicação marcada como divergente',
    );
    expect(result.buffer.toString('utf8')).toContain('Corrigir a comunicação');
  });
});
