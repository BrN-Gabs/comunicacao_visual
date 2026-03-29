import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CreateAuditLogParams = {
  userId?: string | null;
  module: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  description: string;
  metadata?: Prisma.InputJsonValue | null;
};

type AuditLogFilters = {
  page?: number;
  limit?: number;
  module?: string;
  action?: string;
  entityType?: string;
  search?: string;
  userId?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
};

const suspiciousTextPattern = /(?:Ãƒ.|Ã‚.|Ã¢.|ï¿½|Ã.|Â.|â.|�)/;
const fallbackMojibakeEntries = [
  ['ÃƒÂ§', 'ç'],
  ['ÃƒÂ£', 'ã'],
  ['ÃƒÂ¡', 'á'],
  ['ÃƒÂ©', 'é'],
  ['ÃƒÂª', 'ê'],
  ['ÃƒÂ­', 'í'],
  ['ÃƒÂ³', 'ó'],
  ['ÃƒÂ´', 'ô'],
  ['ÃƒÂº', 'ú'],
  ['ÃƒÂµ', 'õ'],
  ['Ãƒâ€¡', 'Ç'],
  ['Ãƒâ€œ', 'Ó'],
  ['Ã§', 'ç'],
  ['Ã£', 'ã'],
  ['Ã¡', 'á'],
  ['Ã©', 'é'],
  ['Ãª', 'ê'],
  ['Ã­', 'í'],
  ['Ã³', 'ó'],
  ['Ã´', 'ô'],
  ['Ãº', 'ú'],
  ['Ãµ', 'õ'],
  ['Ã‡', 'Ç'],
  ['Ã“', 'Ó'],
  ['Â', ''],
] as const;

function normalizeText(value: string) {
  let nextValue = value.trim();

  for (
    let attempt = 0;
    attempt < 3 && suspiciousTextPattern.test(nextValue);
    attempt += 1
  ) {
    try {
      const decodedValue = decodeURIComponent(escape(nextValue));

      if (!decodedValue || decodedValue === nextValue) {
        break;
      }

      nextValue = decodedValue;
    } catch {
      break;
    }
  }

  for (const [brokenValue, fixedValue] of fallbackMojibakeEntries) {
    nextValue = nextValue.split(brokenValue).join(fixedValue);
  }

  return nextValue;
}

function normalizeJsonValue(
  value: Prisma.JsonValue | null,
): Prisma.JsonValue | null {
  if (typeof value === 'string') {
    return normalizeText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, itemValue]) => [
        key,
        normalizeJsonValue(itemValue as Prisma.JsonValue),
      ]),
    ) as Prisma.JsonObject;
  }

  return value;
}

function formatCsvDate(value: Date) {
  return value.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue =
    typeof value === 'string' ? value : JSON.stringify(value, null, 0);
  const normalizedValue = normalizeText(stringValue);
  const escapedValue = normalizedValue.replace(/"/g, '""');

  return `"${escapedValue}"`;
}

function buildCsvContent(rows: Array<Array<unknown>>) {
  return rows.map((row) => row.map(escapeCsvValue).join(';')).join('\n');
}

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async create(params: CreateAuditLogParams) {
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        module: params.module,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        entityLabel: params.entityLabel ?? null,
        description: params.description,
        metadata: params.metadata ?? undefined,
      },
    });
  }

  private buildWhere(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
    const normalizedSearch = filters.search?.trim();

    return {
      ...(filters.module ? { module: filters.module } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.entityId
        ? {
            entityId: {
              contains: filters.entityId,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(filters.startDate || filters.endDate
        ? {
            createdAt: {
              ...(filters.startDate
                ? { gte: new Date(`${filters.startDate}T00:00:00.000Z`) }
                : {}),
              ...(filters.endDate
                ? { lte: new Date(`${filters.endDate}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {}),
      ...(normalizedSearch
        ? {
            OR: [
              {
                description: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                entityLabel: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                entityType: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                entityId: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                module: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                action: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                user: {
                  is: {
                    OR: [
                      {
                        name: {
                          contains: normalizedSearch,
                          mode: 'insensitive',
                        },
                      },
                      {
                        email: {
                          contains: normalizedSearch,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private auditLogSelect() {
    return {
      id: true,
      module: true,
      action: true,
      entityType: true,
      entityId: true,
      entityLabel: true,
      description: true,
      metadata: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    } satisfies Prisma.AuditLogSelect;
  }

  private normalizeLogItem(log: {
    id: string;
    module: string;
    action: string;
    entityType: string;
    entityId: string | null;
    entityLabel: string | null;
    description: string;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null;
  }) {
    return {
      ...log,
      entityLabel: log.entityLabel ? normalizeText(log.entityLabel) : null,
      description: normalizeText(log.description),
      metadata: normalizeJsonValue(log.metadata),
      user: log.user
        ? {
            ...log.user,
            name: normalizeText(log.user.name),
            email: normalizeText(log.user.email),
          }
        : null,
    };
  }

  async findAll(filters: AuditLogFilters) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        select: this.auditLogSelect(),
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((item) => this.normalizeLogItem(item)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFilterOptions() {
    const [modules, actions, entityTypes, users, oldestLog, newestLog] =
      await Promise.all([
        this.prisma.auditLog.findMany({
          distinct: ['module'],
          orderBy: {
            module: 'asc',
          },
          select: {
            module: true,
          },
        }),
        this.prisma.auditLog.findMany({
          distinct: ['action'],
          orderBy: {
            action: 'asc',
          },
          select: {
            action: true,
          },
        }),
        this.prisma.auditLog.findMany({
          distinct: ['entityType'],
          orderBy: {
            entityType: 'asc',
          },
          select: {
            entityType: true,
          },
        }),
        this.prisma.user.findMany({
          where: {
            auditLogs: {
              some: {},
            },
          },
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        }),
        this.prisma.auditLog.findFirst({
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            createdAt: true,
          },
        }),
        this.prisma.auditLog.findFirst({
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            createdAt: true,
          },
        }),
      ]);

    return {
      modules: modules.map((item) => item.module),
      actions: actions.map((item) => item.action),
      entityTypes: entityTypes.map((item) => item.entityType),
      users: users.map((user) => ({
        ...user,
        name: normalizeText(user.name),
        email: normalizeText(user.email),
      })),
      dateRange: {
        oldestAt: oldestLog?.createdAt ?? null,
        newestAt: newestLog?.createdAt ?? null,
      },
    };
  }

  async getMonthlySummary(year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const logs = await this.prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        module: true,
        action: true,
        entityType: true,
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

    const total = logs.length;

    const count = (module: string, action: string, entityType?: string) =>
      logs.filter(
        (log) =>
          log.module === module &&
          log.action === action &&
          (entityType ? log.entityType === entityType : true),
      ).length;

    const communications = {
      created: count('COMMUNICATIONS', 'CREATE', 'COMMUNICATION'),
      updated: count('COMMUNICATIONS', 'UPDATE', 'COMMUNICATION'),
      deleted: count('COMMUNICATIONS', 'DELETE', 'COMMUNICATION'),
      finalized: count('COMMUNICATIONS', 'FINALIZE', 'COMMUNICATION'),
      validated: count('COMMUNICATIONS', 'VALIDATE', 'COMMUNICATION'),
      diverged: count('COMMUNICATIONS', 'DIVERGE', 'COMMUNICATION'),
      assignedImages: count('COMMUNICATIONS', 'ASSIGN_IMAGES', 'COMMUNICATION'),
    };

    const frames = {
      swapCityImage: count('FRAMES', 'SWAP_CITY_IMAGE', 'FRAME'),
      swapGazinImage: count('FRAMES', 'SWAP_GAZIN_IMAGE', 'FRAME'),
      updateDimensions: count('FRAMES', 'UPDATE_DIMENSIONS', 'FRAME'),
    };

    const gazinLibrary = {
      created: count('GAZIN_LIBRARY', 'CREATE', 'GAZIN_LIBRARY_IMAGE'),
      updated: count('GAZIN_LIBRARY', 'UPDATE', 'GAZIN_LIBRARY_IMAGE'),
      updatedStatus: count(
        'GAZIN_LIBRARY',
        'UPDATE_STATUS',
        'GAZIN_LIBRARY_IMAGE',
      ),
      deleted: count('GAZIN_LIBRARY', 'DELETE', 'GAZIN_LIBRARY_IMAGE'),
    };

    const cityImages = {
      createdMany: count('CITY_IMAGES', 'CREATE_MANY', 'PROJECT_CITY_IMAGE'),
      updated: count('CITY_IMAGES', 'UPDATE', 'PROJECT_CITY_IMAGE'),
      deleted: count('CITY_IMAGES', 'DELETE', 'PROJECT_CITY_IMAGE'),
    };

    const projectGazinImages = {
      synced: count(
        'PROJECT_GAZIN_IMAGES',
        'SYNC_FROM_LIBRARY',
        'COMMUNICATION',
      ),
      deleted: count('PROJECT_GAZIN_IMAGES', 'DELETE', 'PROJECT_GAZIN_IMAGE'),
    };

    const users = {
      created: count('USERS', 'CREATE', 'USER'),
      updatedRole: count('USERS', 'UPDATE_ROLE', 'USER'),
      updatedStatus: count('USERS', 'UPDATE_STATUS', 'USER'),
    };

    const byModule = logs.reduce<Record<string, number>>((acc, log) => {
      acc[log.module] = (acc[log.module] ?? 0) + 1;
      return acc;
    }, {});

    const byAction = logs.reduce<Record<string, number>>((acc, log) => {
      acc[log.action] = (acc[log.action] ?? 0) + 1;
      return acc;
    }, {});

    const byUserMap = logs.reduce<
      Record<
        string,
        {
          userId: string | null;
          name: string;
          email: string | null;
          role: string | null;
          totalActions: number;
        }
      >
    >((acc, log) => {
      const key = log.user?.id ?? 'system';
      if (!acc[key]) {
        acc[key] = {
          userId: log.user?.id ?? null,
          name: log.user?.name ? normalizeText(log.user.name) : 'Sistema',
          email: log.user?.email ? normalizeText(log.user.email) : null,
          role: log.user?.role ?? null,
          totalActions: 0,
        };
      }
      acc[key].totalActions += 1;
      return acc;
    }, {});

    const topUsers = Object.values(byUserMap)
      .sort((a, b) => b.totalActions - a.totalActions)
      .slice(0, 10);

    return {
      year,
      month,
      period: {
        start,
        end,
      },
      total,
      communications,
      frames,
      gazinLibrary,
      cityImages,
      projectGazinImages,
      users,
      byModule,
      byAction,
      topUsers,
    };
  }

  private buildAuditLogsCsv(
    items: Array<ReturnType<AuditLogsService['normalizeLogItem']>>,
  ) {
    const rows: Array<Array<unknown>> = [
      [
        'Data/Hora',
        'Modulo',
        'Acao',
        'Tipo de entidade',
        'ID da entidade',
        'Referencia',
        'Usuario',
        'E-mail',
        'Perfil',
        'Descricao',
        'Metadados',
      ],
    ];

    for (const item of items) {
      rows.push([
        formatCsvDate(item.createdAt),
        item.module,
        item.action,
        item.entityType,
        item.entityId,
        item.entityLabel,
        item.user?.name ?? 'Sistema',
        item.user?.email ?? '',
        item.user?.role ?? '',
        item.description,
        item.metadata ? JSON.stringify(item.metadata) : '',
      ]);
    }

    return buildCsvContent(rows);
  }

  private buildMonthlySummaryCsv(
    summary: Awaited<ReturnType<AuditLogsService['getMonthlySummary']>>,
  ) {
    const rows: Array<Array<unknown>> = [
      ['Resumo mensal de auditoria'],
      [
        'Periodo',
        `${summary.month.toString().padStart(2, '0')}/${summary.year}`,
      ],
      ['Inicio', formatCsvDate(summary.period.start)],
      ['Fim', formatCsvDate(summary.period.end)],
      ['Total de acoes', summary.total],
      [],
      ['Comunicacoes'],
      ['Criadas', summary.communications.created],
      ['Atualizadas', summary.communications.updated],
      ['Excluidas', summary.communications.deleted],
      ['Finalizadas', summary.communications.finalized],
      ['Validadas', summary.communications.validated],
      ['Divergentes', summary.communications.diverged],
      ['Redistribuidas', summary.communications.assignedImages],
      [],
      ['Quadros'],
      ['Troca de imagem da cidade', summary.frames.swapCityImage],
      ['Troca de imagem da Gazin', summary.frames.swapGazinImage],
      ['Atualizacao de medidas', summary.frames.updateDimensions],
      [],
      ['Biblioteca Gazin'],
      ['Criadas', summary.gazinLibrary.created],
      ['Atualizadas', summary.gazinLibrary.updated],
      ['Status alterado', summary.gazinLibrary.updatedStatus],
      ['Excluidas', summary.gazinLibrary.deleted],
      [],
      ['Imagens da cidade'],
      ['Criadas em lote', summary.cityImages.createdMany],
      ['Atualizadas', summary.cityImages.updated],
      ['Excluidas', summary.cityImages.deleted],
      [],
      ['Imagens de projeto Gazin'],
      ['Sincronizadas', summary.projectGazinImages.synced],
      ['Excluidas', summary.projectGazinImages.deleted],
      [],
      ['Usuarios'],
      ['Criados', summary.users.created],
      ['Perfil alterado', summary.users.updatedRole],
      ['Status alterado', summary.users.updatedStatus],
      [],
      ['Totais por modulo'],
      ['Modulo', 'Total'],
      ...Object.entries(summary.byModule).map(([key, value]) => [key, value]),
      [],
      ['Totais por acao'],
      ['Acao', 'Total'],
      ...Object.entries(summary.byAction).map(([key, value]) => [key, value]),
      [],
      ['Top usuarios'],
      ['Nome', 'E-mail', 'Perfil', 'Total de acoes'],
      ...summary.topUsers.map((item) => [
        item.name,
        item.email ?? '',
        item.role ?? '',
        item.totalActions,
      ]),
    ];

    return buildCsvContent(rows);
  }

  async exportFilteredCsv(filters: AuditLogFilters) {
    const items = await this.prisma.auditLog.findMany({
      where: this.buildWhere(filters),
      orderBy: {
        createdAt: 'desc',
      },
      select: this.auditLogSelect(),
    });

    const normalizedItems = items.map((item) => this.normalizeLogItem(item));
    const csv = this.buildAuditLogsCsv(normalizedItems);
    const today = new Date().toISOString().slice(0, 10);

    return {
      mimeType: 'text/csv; charset=utf-8',
      fileName: `relatorio-logs-${today}.csv`,
      buffer: Buffer.from(`\uFEFF${csv}`, 'utf8'),
    };
  }

  async exportMonthlySummaryCsv(year: number, month: number) {
    const summary = await this.getMonthlySummary(year, month);
    const csv = this.buildMonthlySummaryCsv(summary);

    return {
      mimeType: 'text/csv; charset=utf-8',
      fileName: `resumo-logs-${year}-${String(month).padStart(2, '0')}.csv`,
      buffer: Buffer.from(`\uFEFF${csv}`, 'utf8'),
    };
  }
}
