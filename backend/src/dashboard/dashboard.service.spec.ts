import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('DashboardService', () => {
  let service: DashboardService;

  const prismaService = {
    user: {
      findMany: jest.fn(),
    },
    communication: {
      groupBy: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const auditLogsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: AuditLogsService,
          useValue: auditLogsService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return active users with aggregated counts', async () => {
    prismaService.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        name: 'Amanda',
        role: 'ADMIN',
      },
      {
        id: 'user-2',
        name: 'Bruno',
        role: 'NORMAL',
      },
    ]);

    prismaService.communication.groupBy.mockResolvedValue([
      {
        createdById: 'user-1',
        status: 'VALIDATED',
        _count: {
          _all: 2,
        },
      },
      {
        createdById: 'user-1',
        status: 'IN_PROGRESS',
        _count: {
          _all: 1,
        },
      },
      {
        createdById: 'user-2',
        status: 'FINALIZED',
        _count: {
          _all: 3,
        },
      },
      {
        createdById: 'user-2',
        status: 'DIVERGENT',
        _count: {
          _all: 2,
        },
      },
    ]);

    await expect(service.getStatusByUser()).resolves.toEqual({
      userStatus: [
        {
          userId: 'user-1',
          name: 'Amanda',
          role: 'ADMIN',
          finalizedCount: 2,
          openCount: 1,
        },
        {
          userId: 'user-2',
          name: 'Bruno',
          role: 'NORMAL',
          finalizedCount: 0,
          openCount: 5,
        },
      ],
    });

    expect(prismaService.user.findMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
    });
    expect(prismaService.communication.groupBy).toHaveBeenCalledTimes(1);
  });

  it('should include active users with zero counts', async () => {
    prismaService.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        name: 'Carla',
        role: 'VIP',
      },
    ]);

    prismaService.communication.groupBy.mockResolvedValue([]);

    await expect(service.getStatusByUser()).resolves.toEqual({
      userStatus: [
        {
          userId: 'user-1',
          name: 'Carla',
          role: 'VIP',
          finalizedCount: 0,
          openCount: 0,
        },
      ],
    });
  });

  it('should return an empty list when there are no active users', async () => {
    prismaService.user.findMany.mockResolvedValue([]);

    await expect(service.getStatusByUser()).resolves.toEqual({
      userStatus: [],
    });

    expect(prismaService.communication.groupBy).not.toHaveBeenCalled();
  });

  it('should return recent exports ordered by newest first', async () => {
    prismaService.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-2',
        action: 'EXPORT_COMMUNICATION_PDF_ZIP',
        entityType: 'COMMUNICATION',
        entityId: 'comm-2',
        entityLabel: 'Filial 2, Porto Velho - RO',
        description: 'Comunicacao exportada em ZIP com PDFs',
        createdAt: new Date('2026-03-29T16:00:00.000Z'),
        user: {
          id: 'user-2',
          name: 'Bruno',
          email: 'bruno@example.com',
          role: 'ADMIN',
        },
      },
      {
        id: 'log-1',
        action: 'EXPORT_FRAME_JPG',
        entityType: 'FRAME',
        entityId: 'frame-1',
        entityLabel: 'Filial 1 / Parede 1 / Quadro 1',
        description: 'Quadro exportado em JPG',
        createdAt: new Date('2026-03-29T15:00:00.000Z'),
        user: {
          id: 'user-1',
          name: 'Amanda',
          email: 'amanda@example.com',
          role: 'NORMAL',
        },
      },
    ]);

    await expect(service.getRecentExports()).resolves.toEqual({
      recentExports: [
        {
          id: 'log-2',
          action: 'EXPORT_COMMUNICATION_PDF_ZIP',
          entityType: 'COMMUNICATION',
          entityId: 'comm-2',
          entityLabel: 'Filial 2, Porto Velho - RO',
          description: 'Comunicacao exportada em ZIP com PDFs',
          createdAt: new Date('2026-03-29T16:00:00.000Z'),
          user: {
            id: 'user-2',
            name: 'Bruno',
            email: 'bruno@example.com',
            role: 'ADMIN',
          },
        },
        {
          id: 'log-1',
          action: 'EXPORT_FRAME_JPG',
          entityType: 'FRAME',
          entityId: 'frame-1',
          entityLabel: 'Filial 1 / Parede 1 / Quadro 1',
          description: 'Quadro exportado em JPG',
          createdAt: new Date('2026-03-29T15:00:00.000Z'),
          user: {
            id: 'user-1',
            name: 'Amanda',
            email: 'amanda@example.com',
            role: 'NORMAL',
          },
        },
      ],
    });

    expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        module: 'EXPORTS',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        entityLabel: true,
        description: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  });

  it('should clear recent exports and register the cleanup', async () => {
    prismaService.auditLog.deleteMany.mockResolvedValue({
      count: 3,
    });
    auditLogsService.create.mockResolvedValue({
      id: 'audit-1',
    });

    await expect(service.clearRecentExports('admin-1')).resolves.toEqual({
      message: 'Exportacoes recentes removidas com sucesso',
      deletedCount: 3,
    });

    expect(prismaService.auditLog.deleteMany).toHaveBeenCalledWith({
      where: {
        module: 'EXPORTS',
      },
    });

    expect(auditLogsService.create).toHaveBeenCalledWith({
      userId: 'admin-1',
      module: 'DASHBOARD',
      action: 'CLEAR_RECENT_EXPORTS',
      entityType: 'AUDIT_LOG',
      description: 'Exportacoes recentes removidas do dashboard',
      metadata: {
        deletedCount: 3,
      },
    });
  });
});
