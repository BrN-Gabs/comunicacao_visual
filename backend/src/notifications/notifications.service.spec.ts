import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const prismaService = {
    auditLog: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should map audit logs into notifications with links and tone', async () => {
    prismaService.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-2',
        module: 'COMMUNICATIONS',
        action: 'DIVERGE',
        entityType: 'COMMUNICATION',
        entityId: 'comm-2',
        entityLabel: 'Filial 2, Porto Velho - RO',
        description: 'ComunicaÃ§Ã£o marcada como divergente',
        metadata: {
          comment: 'Ajustar a foto da cidade e a comunicaÃ§Ã£o',
        },
        createdAt: new Date('2026-03-29T18:00:00.000Z'),
        user: {
          id: 'admin-1',
          name: 'Amanda',
          email: 'amanda@example.com',
          role: 'ADMIN',
        },
      },
      {
        id: 'log-1',
        module: 'FRAMES',
        action: 'UPDATE_DIMENSIONS',
        entityType: 'FRAME',
        entityId: 'frame-1',
        entityLabel: 'Filial 1 / Parede 1 / Quadro 1',
        description: 'Dimensoes do quadro atualizadas',
        metadata: {
          communicationId: 'comm-1',
        },
        createdAt: new Date('2026-03-29T17:00:00.000Z'),
        user: {
          id: 'user-1',
          name: 'Bruno',
          email: 'bruno@example.com',
          role: 'NORMAL',
        },
      },
    ]);

    const result = await service.getRecent();

    expect(result.notifications).toEqual([
      {
        id: 'log-2',
        module: 'COMMUNICATIONS',
        action: 'DIVERGE',
        entityType: 'COMMUNICATION',
        entityId: 'comm-2',
        entityLabel: 'Filial 2, Porto Velho - RO',
        title: 'Comunicacao marcada como divergente',
        description:
          'Comunicação marcada como divergente. Comentario: Ajustar a foto da cidade e a comunicação',
        href: '/communications/comm-2',
        tone: 'danger',
        createdAt: new Date('2026-03-29T18:00:00.000Z'),
        user: {
          id: 'admin-1',
          name: 'Amanda',
          email: 'amanda@example.com',
          role: 'ADMIN',
        },
      },
      {
        id: 'log-1',
        module: 'FRAMES',
        action: 'UPDATE_DIMENSIONS',
        entityType: 'FRAME',
        entityId: 'frame-1',
        entityLabel: 'Filial 1 / Parede 1 / Quadro 1',
        title: 'Dimensoes do quadro atualizadas',
        description: 'Dimensoes do quadro atualizadas',
        href: '/communications/comm-1',
        tone: 'info',
        createdAt: new Date('2026-03-29T17:00:00.000Z'),
        user: {
          id: 'user-1',
          name: 'Bruno',
          email: 'bruno@example.com',
          role: 'NORMAL',
        },
      },
    ]);

    expect(result.meta.limit).toBe(12);
    expect(result.meta.generatedAt).toBeInstanceOf(Date);

    expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        module: {
          in: [
            'COMMUNICATIONS',
            'FRAMES',
            'CITY_IMAGES',
            'CITY_LIBRARY',
            'GAZIN_LIBRARY',
            'PROJECT_GAZIN_IMAGES',
            'USERS',
            'EXPORTS',
            'DASHBOARD',
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 12,
      select: {
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
      },
    });
  });

  it('should clamp the recent notifications limit', async () => {
    prismaService.auditLog.findMany.mockResolvedValue([]);

    await service.getRecent(50);

    expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
      }),
    );
  });
});
