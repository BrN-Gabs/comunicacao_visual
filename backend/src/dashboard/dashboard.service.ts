import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

type TrackedCommunicationStatus =
  | 'IN_PROGRESS'
  | 'FINALIZED'
  | 'DIVERGENT'
  | 'VALIDATED';

const trackedStatuses: TrackedCommunicationStatus[] = [
  'IN_PROGRESS',
  'FINALIZED',
  'DIVERGENT',
  'VALIDATED',
];

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getStatusByUser() {
    const users = await this.prisma.user.findMany({
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

    if (!users.length) {
      return {
        userStatus: [],
      };
    }

    const communicationCounts = await this.prisma.communication.groupBy({
      by: ['createdById', 'status'],
      where: {
        createdById: {
          in: users.map((user) => user.id),
        },
        status: {
          in: trackedStatuses,
        },
      },
      _count: {
        _all: true,
      },
    });

    const countsByUserId = new Map<
      string,
      { finalizedCount: number; openCount: number }
    >();

    for (const item of communicationCounts) {
      const currentCounts = countsByUserId.get(item.createdById) ?? {
        finalizedCount: 0,
        openCount: 0,
      };

      if (item.status === 'VALIDATED') {
        currentCounts.finalizedCount += item._count._all;
      } else {
        currentCounts.openCount += item._count._all;
      }

      countsByUserId.set(item.createdById, currentCounts);
    }

    return {
      userStatus: users.map((user) => {
        const counts = countsByUserId.get(user.id) ?? {
          finalizedCount: 0,
          openCount: 0,
        };

        return {
          userId: user.id,
          name: user.name,
          role: user.role,
          finalizedCount: counts.finalizedCount,
          openCount: counts.openCount,
        };
      }),
    };
  }

  async getRecentExports(limit = 10) {
    const recentExports = await this.prisma.auditLog.findMany({
      where: {
        module: 'EXPORTS',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
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

    return {
      recentExports,
    };
  }

  async clearRecentExports(userId: string) {
    const { count } = await this.prisma.auditLog.deleteMany({
      where: {
        module: 'EXPORTS',
      },
    });

    await this.auditLogsService.create({
      userId,
      module: 'DASHBOARD',
      action: 'CLEAR_RECENT_EXPORTS',
      entityType: 'AUDIT_LOG',
      description: 'Exportações recentes removidas do dashboard',
      metadata: {
        deletedCount: count,
      },
    });

    return {
      message:
        count > 0
          ? 'Exportações recentes removidas com sucesso'
          : 'Não havia exportações recentes para remover',
      deletedCount: count,
    };
  }
}
