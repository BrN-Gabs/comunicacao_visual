import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { FilterCommunicationsDto } from './dto/filter-communications.dto';
import { UpdateCommunicationDto } from './dto/update-communication.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AddCommunicationWallDto } from './dto/add-communication-wall.dto';
import { AddCommunicationFrameDto } from './dto/add-communication-frame.dto';

type CurrentUser = {
  id: string;
  role: 'ADMIN' | 'VIP' | 'NORMAL';
};

type CommunicationStatus =
  | 'IN_PROGRESS'
  | 'FINALIZED'
  | 'DIVERGENT'
  | 'VALIDATED';

@Injectable()
export class CommunicationsService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(userId: string, data: CreateCommunicationDto) {
    const city = await this.getCityLibrarySource(data.cityLibraryId);
    const totalWalls = data.walls.length;
    const totalFrames = data.walls.reduce(
      (acc, wall) => acc + wall.frames.length,
      0,
    );

    const fullName = `${data.storeName}, ${city.fullName}`;

    const communication = await this.prisma.$transaction(async (tx) => {
      const created = await tx.communication.create({
        data: {
          storeName: data.storeName,
          cityLibraryId: city.id,
          cityName: city.name,
          state: city.state,
          fullName,
          status: 'IN_PROGRESS',
          totalWalls,
          totalFrames,
          createdById: userId,
          walls: {
            create: data.walls.map((wall) => ({
              name: wall.name,
              order: wall.order,
              frames: {
                create: wall.frames.map((frame, index) => ({
                  name: frame.name ?? `Quadro ${index + 1}`,
                  order: frame.order,
                  widthM: frame.widthM,
                  heightM: frame.heightM,
                })),
              },
            })),
          },
        },
        select: this.defaultSelect(),
      });

      const cityImages = this.buildProjectCityImagesFromCityLibrary(
        created.id,
        city,
      );

      if (cityImages.length > 0) {
        await tx.projectCityImage.createMany({
          data: cityImages,
        });
      }

      return created;
    });

    await this.createStatusHistory({
      communicationId: communication.id,
      oldStatus: null,
      newStatus: 'IN_PROGRESS',
      changedById: userId,
      comment: 'ComunicaÃƒÂ§ÃƒÂ£o criada',
    });

    await this.auditLogsService.create({
      userId,
      module: 'COMMUNICATIONS',
      action: 'CREATE',
      entityType: 'COMMUNICATION',
      entityId: communication.id,
      entityLabel: communication.fullName,
      description: 'ComunicaÃƒÂ§ÃƒÂ£o criada',
      metadata: {
        totalWalls: communication.totalWalls,
        totalFrames: communication.totalFrames,
        status: communication.status,
        cityLibraryId: city.id,
        importedCityImages: city.photographers.reduce(
          (totalImages, photographer) =>
            totalImages + photographer.images.length,
          0,
        ),
      },
    });

    return communication;
  }

  async findAll(filters: FilterCommunicationsDto) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 10;
    const skip = (page - 1) * limit;
    const normalizedSearch = this.normalizeSearch(filters.search);
    const matchedStatuses = normalizedSearch
      ? this.getStatusesFromSearch(normalizedSearch)
      : [];
    const searchConditions: Prisma.CommunicationWhereInput[] = normalizedSearch
      ? [
          {
            id: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          },
          {
            storeName: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          },
          {
            cityName: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          },
          {
            fullName: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          },
          {
            createdBy: {
              name: {
                contains: normalizedSearch,
                mode: 'insensitive',
              },
            },
          },
          ...(matchedStatuses.length > 0
            ? [
                {
                  status: {
                    in: matchedStatuses,
                  },
                },
              ]
            : []),
        ]
      : [];

    const where: Prisma.CommunicationWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.cityName
        ? {
            cityName: {
              contains: filters.cityName,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(filters.createdByName
        ? {
            createdBy: {
              name: {
                contains: filters.createdByName,
                mode: 'insensitive',
              },
            },
          }
        : {}),
      ...(searchConditions.length > 0
        ? {
            OR: searchConditions,
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.communication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: this.listSelect(),
      }),
      this.prisma.communication.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const communication = await this.prisma.communication.findUnique({
      where: { id },
      select: this.defaultSelect(),
    });

    if (!communication) {
      throw new NotFoundException('ComunicaÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrada');
    }

    return communication;
  }

  async getSummary(id: string) {
    const communication = await this.prisma.communication.findUnique({
      where: { id },
      select: this.defaultSelect(),
    });

    if (!communication) {
      throw new NotFoundException('ComunicaÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrada');
    }

    const [
      readiness,
      statusHistory,
      availableCityImages,
      availableGazinImages,
    ] = await Promise.all([
      this.getReadiness(id),
      this.prisma.communicationStatusHistory.findMany({
        where: {
          communicationId: id,
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          oldStatus: true,
          newStatus: true,
          comment: true,
          createdAt: true,
          changedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.projectCityImage.findMany({
        where: {
          communicationId: id,
          status: 'AVAILABLE',
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          communicationId: true,
          imageUrl: true,
          fileName: true,
          authorName: true,
          creditText: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.projectGazinImage.findMany({
        where: {
          communicationId: id,
          status: 'AVAILABLE',
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          communicationId: true,
          gazinLibraryImageId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          gazinLibraryImage: {
            select: {
              id: true,
              title: true,
              description: true,
              imageUrl: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const totalAssignedFrames = communication.walls.reduce((acc, wall) => {
      return (
        acc +
        wall.frames.filter(
          (frame) => frame.projectCityImageId && frame.projectGazinImageId,
        ).length
      );
    }, 0);

    const totalUnassignedFrames =
      communication.totalFrames - totalAssignedFrames;

    return {
      communication,
      readiness,
      statusHistory,
      availableCityImages,
      availableGazinImages,
      stats: {
        totalWalls: communication.totalWalls,
        totalFrames: communication.totalFrames,
        totalAssignedFrames,
        totalUnassignedFrames,
        availableCityImages: availableCityImages.length,
        availableGazinImages: availableGazinImages.length,
      },
    };
  }

  async update(id: string, user: CurrentUser, data: UpdateCommunicationDto) {
    const existing = await this.prisma.communication.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        status: true,
        fullName: true,
        cityLibraryId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('ComunicaÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrada');
    }

    const isOwner = existing.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'VocÃƒÂª nÃƒÂ£o tem permissÃƒÂ£o para editar esta comunicaÃƒÂ§ÃƒÂ£o',
      );
    }

    const city = await this.getCityLibrarySource(data.cityLibraryId);
    const totalWalls = data.walls.length;
    const totalFrames = data.walls.reduce(
      (acc, wall) => acc + wall.frames.length,
      0,
    );

    const fullName = `${data.storeName}, ${city.fullName}`;
    const cityChanged = existing.cityLibraryId !== city.id;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.wall.deleteMany({
        where: {
          communicationId: id,
        },
      });

      if (cityChanged) {
        await tx.projectCityImage.deleteMany({
          where: {
            communicationId: id,
          },
        });
      }

      const nextStatus =
        existing.status === 'VALIDATED' ? 'FINALIZED' : existing.status;

      const result = await tx.communication.update({
        where: { id },
        data: {
          storeName: data.storeName,
          cityLibraryId: city.id,
          cityName: city.name,
          state: city.state,
          fullName,
          totalWalls,
          totalFrames,
          status: nextStatus,
          ...(existing.status === 'DIVERGENT'
            ? { divergenceComment: null }
            : {}),
          walls: {
            create: data.walls.map((wall) => ({
              name: wall.name,
              order: wall.order,
              frames: {
                create: wall.frames.map((frame, index) => ({
                  name: frame.name ?? `Quadro ${index + 1}`,
                  order: frame.order,
                  widthM: frame.widthM,
                  heightM: frame.heightM,
                })),
              },
            })),
          },
        },
        select: this.defaultSelect(),
      });

      if (cityChanged) {
        const cityImages = this.buildProjectCityImagesFromCityLibrary(
          result.id,
          city,
        );

        if (cityImages.length > 0) {
          await tx.projectCityImage.createMany({
            data: cityImages,
          });
        }
      }

      if (existing.status === 'VALIDATED') {
        await tx.communicationStatusHistory.create({
          data: {
            communicationId: id,
            oldStatus: 'VALIDATED',
            newStatus: 'FINALIZED',
            changedById: user.id,
            comment: 'ComunicaÃƒÂ§ÃƒÂ£o editada apÃƒÂ³s validaÃƒÂ§ÃƒÂ£o',
          },
        });
      }

      return result;
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'COMMUNICATIONS',
      action: 'UPDATE',
      entityType: 'COMMUNICATION',
      entityId: updated.id,
      entityLabel: updated.fullName,
      description: 'ComunicaÃƒÂ§ÃƒÂ£o atualizada',
      metadata: {
        oldStatus: existing.status,
        newStatus: updated.status,
        totalWalls: updated.totalWalls,
        totalFrames: updated.totalFrames,
        oldCityLibraryId: existing.cityLibraryId,
        newCityLibraryId: city.id,
        cityChanged,
      },
    });

    return updated;
  }

  async remove(id: string, user: CurrentUser) {
    const existing = await this.prisma.communication.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        fullName: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('ComunicaÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrada');
    }

    const isOwner = existing.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'VocÃƒÂª nÃƒÂ£o tem permissÃƒÂ£o para excluir esta comunicaÃƒÂ§ÃƒÂ£o',
      );
    }

    await this.prisma.communication.delete({
      where: { id },
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'COMMUNICATIONS',
      action: 'DELETE',
      entityType: 'COMMUNICATION',
      entityId: existing.id,
      entityLabel: existing.fullName,
      description: 'ComunicaÃƒÂ§ÃƒÂ£o removida',
    });

    return {
      message: 'ComunicaÃƒÂ§ÃƒÂ£o removida com sucesso',
    };
  }

  async addWall(
    communicationId: string,
    user: CurrentUser,
    payload: AddCommunicationWallDto,
  ) {
    const communication = await this.prisma.communication.findUnique({
      where: { id: communicationId },
      select: {
        id: true,
        fullName: true,
        createdById: true,
        status: true,
      },
    });

    if (!communication) {
      throw new NotFoundException(
        'ComunicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o nÃƒÆ’Ã‚Â£o encontrada',
      );
    }

    const isOwner = communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'VocÃƒÆ’Ã‚Âª nÃƒÆ’Ã‚Â£o tem permissÃƒÆ’Ã‚Â£o para editar esta comunicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o',
      );
    }

    const lastWall = await this.prisma.wall.findFirst({
      where: { communicationId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (lastWall?.order ?? 0) + 1;
    const name = payload.name.trim() || `Parede ${nextOrder}`;

    const createdWall = await this.prisma.$transaction(async (tx) => {
      const wall = await tx.wall.create({
        data: {
          communicationId,
          name,
          order: nextOrder,
        },
        select: {
          id: true,
          name: true,
          order: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const totalWalls = await tx.wall.count({
        where: {
          communicationId,
        },
      });
      const totalFrames = await tx.frame.count({
        where: {
          wall: {
            communicationId,
          },
        },
      });

      await tx.communication.update({
        where: { id: communicationId },
        data: {
          totalWalls,
          totalFrames,
        },
      });

      await this.reopenIfValidated(
        tx,
        communicationId,
        user.id,
        communication.status,
      );

      return wall;
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'COMMUNICATIONS',
      action: 'ADD_WALL',
      entityType: 'WALL',
      entityId: createdWall.id,
      entityLabel: `${communication.fullName} / ${createdWall.name}`,
      description: 'Parede adicionada ÃƒÂ comunicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o',
      metadata: {
        communicationId,
        communicationLabel: communication.fullName,
        wallName: createdWall.name,
        wallOrder: createdWall.order,
      },
    });

    return createdWall;
  }

  async addFrame(
    wallId: string,
    user: CurrentUser,
    payload: AddCommunicationFrameDto,
  ) {
    const wall = await this.prisma.wall.findUnique({
      where: { id: wallId },
      select: {
        id: true,
        name: true,
        communicationId: true,
        communication: {
          select: {
            id: true,
            fullName: true,
            createdById: true,
            status: true,
          },
        },
      },
    });

    if (!wall) {
      throw new NotFoundException('Parede nÃƒÆ’Ã‚Â£o encontrada');
    }

    const communication = wall.communication;
    const isOwner = communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'VocÃƒÆ’Ã‚Âª nÃƒÆ’Ã‚Â£o tem permissÃƒÆ’Ã‚Â£o para editar esta comunicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o',
      );
    }

    const lastFrame = await this.prisma.frame.findFirst({
      where: { wallId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (lastFrame?.order ?? 0) + 1;
    const name = payload.name?.trim() || `Quadro ${nextOrder}`;

    const createdFrame = await this.prisma.$transaction(async (tx) => {
      const frame = await tx.frame.create({
        data: {
          wallId,
          name,
          order: nextOrder,
          widthM: payload.widthM,
          heightM: payload.heightM,
        },
        select: {
          id: true,
          name: true,
          order: true,
          widthM: true,
          heightM: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const totalWalls = await tx.wall.count({
        where: {
          communicationId: communication.id,
        },
      });
      const totalFrames = await tx.frame.count({
        where: {
          wall: {
            communicationId: communication.id,
          },
        },
      });

      await tx.communication.update({
        where: { id: communication.id },
        data: {
          totalWalls,
          totalFrames,
        },
      });

      await this.reopenIfValidated(
        tx,
        communication.id,
        user.id,
        communication.status,
      );

      return frame;
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'COMMUNICATIONS',
      action: 'ADD_FRAME',
      entityType: 'FRAME',
      entityId: createdFrame.id,
      entityLabel: `${communication.fullName} / ${wall.name} / ${createdFrame.name}`,
      description: 'Quadro adicionado ÃƒÂ comunicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o',
      metadata: {
        communicationId: communication.id,
        communicationLabel: communication.fullName,
        wallId: wall.id,
        wallName: wall.name,
        frameName: createdFrame.name,
        frameOrder: createdFrame.order,
        widthM: createdFrame.widthM,
        heightM: createdFrame.heightM,
      },
    });

    return createdFrame;
  }

  async removeWall(wallId: string, user: CurrentUser) {
    const wall = await this.prisma.wall.findUnique({
      where: { id: wallId },
      select: {
        id: true,
        name: true,
        frames: {
          select: {
            id: true,
            name: true,
            projectCityImageId: true,
            projectGazinImageId: true,
          },
        },
        communication: {
          select: {
            id: true,
            fullName: true,
            createdById: true,
            status: true,
          },
        },
      },
    });

    if (!wall) {
      throw new NotFoundException('Parede nao encontrada');
    }

    const communication = wall.communication;
    const isOwner = communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Voce nao tem permissao para excluir esta parede',
      );
    }

    const cityImageIds = Array.from(
      new Set(
        wall.frames
          .map((frame) => frame.projectCityImageId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const gazinImageIds = Array.from(
      new Set(
        wall.frames
          .map((frame) => frame.projectGazinImageId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.wall.delete({
        where: { id: wallId },
      });

      if (cityImageIds.length || gazinImageIds.length) {
        const remainingAssignments = await tx.frame.findMany({
          where: {
            OR: [
              ...(cityImageIds.length
                ? [{ projectCityImageId: { in: cityImageIds } }]
                : []),
              ...(gazinImageIds.length
                ? [{ projectGazinImageId: { in: gazinImageIds } }]
                : []),
            ],
          },
          select: {
            projectCityImageId: true,
            projectGazinImageId: true,
          },
        });

        const usedCityImageIds = new Set(
          remainingAssignments
            .map((frame) => frame.projectCityImageId)
            .filter((value): value is string => Boolean(value)),
        );
        const usedGazinImageIds = new Set(
          remainingAssignments
            .map((frame) => frame.projectGazinImageId)
            .filter((value): value is string => Boolean(value)),
        );

        const cityImageIdsToRelease = cityImageIds.filter(
          (id) => !usedCityImageIds.has(id),
        );
        const gazinImageIdsToRelease = gazinImageIds.filter(
          (id) => !usedGazinImageIds.has(id),
        );

        if (cityImageIdsToRelease.length) {
          await tx.projectCityImage.updateMany({
            where: {
              id: {
                in: cityImageIdsToRelease,
              },
            },
            data: {
              status: 'AVAILABLE',
            },
          });
        }

        if (gazinImageIdsToRelease.length) {
          await tx.projectGazinImage.updateMany({
            where: {
              id: {
                in: gazinImageIdsToRelease,
              },
            },
            data: {
              status: 'AVAILABLE',
            },
          });
        }
      }

      const totalWalls = await tx.wall.count({
        where: {
          communicationId: communication.id,
        },
      });

      const totalFrames = await tx.frame.count({
        where: {
          wall: {
            communicationId: communication.id,
          },
        },
      });

      await tx.communication.update({
        where: { id: communication.id },
        data: {
          totalWalls,
          totalFrames,
        },
      });

      await this.reopenIfValidated(
        tx,
        communication.id,
        user.id,
        communication.status,
      );
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'COMMUNICATIONS',
      action: 'DELETE_WALL',
      entityType: 'WALL',
      entityId: wall.id,
      entityLabel: `${communication.fullName} / ${wall.name}`,
      description: 'Parede removida da comunicacao',
      metadata: {
        communicationId: communication.id,
        communicationLabel: communication.fullName,
        wallName: wall.name,
        removedFrames: wall.frames.map((frame) => ({
          id: frame.id,
          name: frame.name,
        })),
      },
    });

    return {
      message: 'Parede removida com sucesso',
    };
  }

  async getReadiness(id: string) {
    const communication = await this.prisma.communication.findUnique({
      where: { id },
      select: {
        id: true,
        totalFrames: true,
      },
    });

    if (!communication) {
      throw new NotFoundException('ComunicaÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrada');
    }

    const [totalCityImages, totalProjectGazinImages] = await Promise.all([
      this.prisma.projectCityImage.count({
        where: {
          communicationId: id,
        },
      }),
      this.prisma.projectGazinImage.count({
        where: {
          communicationId: id,
        },
      }),
    ]);

    const cityImagesEnough = totalCityImages >= communication.totalFrames;
    const gazinImagesEnough =
      totalProjectGazinImages >= communication.totalFrames;

    const missingCityImages = cityImagesEnough
      ? 0
      : communication.totalFrames - totalCityImages;

    const missingGazinImages = gazinImagesEnough
      ? 0
      : communication.totalFrames - totalProjectGazinImages;

    return {
      communicationId: communication.id,
      totalFrames: communication.totalFrames,
      totalCityImages,
      totalProjectGazinImages,
      cityImagesEnough,
      gazinImagesEnough,
      canProceed: cityImagesEnough && gazinImagesEnough,
      missingCityImages,
      missingGazinImages,
    };
  }

  async finalize(id: string, user: CurrentUser) {
    const communication = await this.prisma.communication.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        status: true,
        fullName: true,
      },
    });

    if (!communication) {
      throw new NotFoundException('ComunicaÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrada');
    }

    const isOwner = communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'VocÃƒÂª nÃƒÂ£o tem permissÃƒÂ£o para finalizar esta comunicaÃƒÂ§ÃƒÂ£o',
      );
    }

    if (communication.status === 'FINALIZED') {
      throw new ForbiddenException(
        'Esta comunicaÃƒÂ§ÃƒÂ£o jÃƒÂ¡ foi finalizada e aguarda validaÃƒÂ§ÃƒÂ£o do Admin',
      );
    }

    if (communication.status === 'VALIDATED') {
      throw new ForbiddenException(
        'Esta comunicaÃƒÂ§ÃƒÂ£o jÃƒÂ¡ foi validada pelo Admin',
      );
    }

    const readiness = await this.getReadiness(id);

    if (!readiness.cityImagesEnough) {
      throw new ForbiddenException(
        `Faltam ${readiness.missingCityImages} imagem(ns) da cidade para finalizar esta comunicaÃƒÂ§ÃƒÂ£o`,
      );
    }

    if (!readiness.gazinImagesEnough) {
      throw new ForbiddenException(
        `Faltam ${readiness.missingGazinImages} imagem(ns) da Gazin para finalizar esta comunicaÃƒÂ§ÃƒÂ£o`,
      );
    }

    const now = new Date();
    const isAdminCreator = isAdmin && isOwner;
    const nextStatus: CommunicationStatus = isAdminCreator
      ? 'VALIDATED'
      : 'FINALIZED';

    const updated = await this.prisma.communication.update({
      where: { id },
      data: {
        status: nextStatus,
        finalizedAt: now,
        ...(isAdminCreator
          ? {
              validatedAt: now,
              validatedById: user.id,
            }
          : {
              validatedAt: null,
              validatedById: null,
            }),
      },
      select: this.defaultSelect(),
    });

    await this.createStatusHistory({
      communicationId: id,
      oldStatus: communication.status,
      newStatus: nextStatus,
      changedById: user.id,
      comment: isAdminCreator
        ? 'ComunicaÃƒÂ§ÃƒÂ£o finalizada e validada automaticamente pelo Admin'
        : 'ComunicaÃƒÂ§ÃƒÂ£o finalizada',
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'COMMUNICATIONS',
      action: 'FINALIZE',
      entityType: 'COMMUNICATION',
      entityId: updated.id,
      entityLabel: updated.fullName,
      description: isAdminCreator
        ? 'ComunicaÃƒÂ§ÃƒÂ£o finalizada e validada automaticamente pelo Admin'
        : 'ComunicaÃƒÂ§ÃƒÂ£o finalizada',
      metadata: {
        oldStatus: communication.status,
        newStatus: nextStatus,
      },
    });

    return updated;
  }

  async validateCommunication(id: string, user: CurrentUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Apenas Admin pode validar uma comunicaÃƒÂ§ÃƒÂ£o',
      );
    }

    const communication = await this.prisma.communication.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        fullName: true,
      },
    });

    if (!communication) {
      throw new NotFoundException('ComunicaÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrada');
    }

    if (communication.status !== 'FINALIZED') {
      throw new ForbiddenException(
        'Somente comunicaÃƒÂ§ÃƒÂµes finalizadas podem ser validadas',
      );
    }

    const now = new Date();

    const updated = await this.prisma.communication.update({
      where: { id },
      data: {
        status: 'VALIDATED',
        validatedAt: now,
        validatedById: user.id,
        divergenceComment: null,
      },
      select: this.defaultSelect(),
    });

    await this.createStatusHistory({
      communicationId: id,
      oldStatus: communication.status,
      newStatus: 'VALIDATED',
      changedById: user.id,
      comment: 'ComunicaÃƒÂ§ÃƒÂ£o validada pelo Admin',
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'COMMUNICATIONS',
      action: 'VALIDATE',
      entityType: 'COMMUNICATION',
      entityId: updated.id,
      entityLabel: updated.fullName,
      description: 'ComunicaÃƒÂ§ÃƒÂ£o validada pelo Admin',
      metadata: {
        oldStatus: communication.status,
        newStatus: 'VALIDATED',
      },
    });

    return updated;
  }

  async divergeCommunication(id: string, user: CurrentUser, comment: string) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Apenas Admin pode marcar uma comunicaÃƒÂ§ÃƒÂ£o como divergente',
      );
    }

    const communication = await this.prisma.communication.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        fullName: true,
      },
    });

    if (!communication) {
      throw new NotFoundException('ComunicaÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrada');
    }

    if (communication.status !== 'FINALIZED') {
      throw new ForbiddenException(
        'Somente comunicaÃƒÂ§ÃƒÂµes finalizadas podem ser marcadas como divergentes',
      );
    }

    const updated = await this.prisma.communication.update({
      where: { id },
      data: {
        status: 'DIVERGENT',
        divergenceComment: comment,
        validatedAt: null,
        validatedById: null,
      },
      select: this.defaultSelect(),
    });

    await this.createStatusHistory({
      communicationId: id,
      oldStatus: communication.status,
      newStatus: 'DIVERGENT',
      changedById: user.id,
      comment,
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'COMMUNICATIONS',
      action: 'DIVERGE',
      entityType: 'COMMUNICATION',
      entityId: updated.id,
      entityLabel: updated.fullName,
      description: 'ComunicaÃƒÂ§ÃƒÂ£o marcada como divergente',
      metadata: {
        oldStatus: communication.status,
        newStatus: 'DIVERGENT',
        comment,
      },
    });

    return updated;
  }

  async getStatusHistory(id: string) {
    const communication = await this.prisma.communication.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!communication) {
      throw new NotFoundException('ComunicaÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrada');
    }

    return this.prisma.communicationStatusHistory.findMany({
      where: {
        communicationId: id,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        oldStatus: true,
        newStatus: true,
        comment: true,
        createdAt: true,
        changedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async assignImages(id: string, user: CurrentUser) {
    const communication = await this.prisma.communication.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        totalFrames: true,
        fullName: true,
      },
    });

    if (!communication) {
      throw new NotFoundException('ComunicaÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrada');
    }

    const isOwner = communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'VocÃƒÂª nÃƒÂ£o tem permissÃƒÂ£o para alocar imagens nesta comunicaÃƒÂ§ÃƒÂ£o',
      );
    }

    const frames = await this.prisma.frame.findMany({
      where: {
        wall: {
          communicationId: id,
        },
      },
      orderBy: [{ wall: { order: 'asc' } }, { order: 'asc' }],
      select: {
        id: true,
        projectCityImageId: true,
        projectGazinImageId: true,
      },
    });

    const cityImages = await this.prisma.projectCityImage.findMany({
      where: {
        communicationId: id,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
      },
    });

    const gazinImages = await this.prisma.projectGazinImage.findMany({
      where: {
        communicationId: id,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
      },
    });

    if (cityImages.length < frames.length) {
      throw new ForbiddenException(
        `Faltam ${frames.length - cityImages.length} imagem(ns) da cidade para alocar nos quadros`,
      );
    }

    if (gazinImages.length < frames.length) {
      throw new ForbiddenException(
        `Faltam ${frames.length - gazinImages.length} imagem(ns) da Gazin para alocar nos quadros`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.frame.updateMany({
        where: {
          wall: {
            communicationId: id,
          },
        },
        data: {
          projectCityImageId: null,
          projectGazinImageId: null,
          cityImageZoom: 1,
          cityImageOffsetX: 0,
          cityImageOffsetY: 0,
          gazinImageZoom: 1,
          gazinImageOffsetX: 0,
          gazinImageOffsetY: 0,
        },
      });

      await tx.projectCityImage.updateMany({
        where: {
          communicationId: id,
        },
        data: {
          status: 'AVAILABLE',
        },
      });

      await tx.projectGazinImage.updateMany({
        where: {
          communicationId: id,
        },
        data: {
          status: 'AVAILABLE',
        },
      });

      const freshFrames = await tx.frame.findMany({
        where: {
          wall: {
            communicationId: id,
          },
        },
        orderBy: [{ wall: { order: 'asc' } }, { order: 'asc' }],
        select: {
          id: true,
        },
      });

      const freshCityImages = await tx.projectCityImage.findMany({
        where: {
          communicationId: id,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
        },
      });

      const freshGazinImages = await tx.projectGazinImage.findMany({
        where: {
          communicationId: id,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
        },
      });

      for (let i = 0; i < freshFrames.length; i++) {
        const frame = freshFrames[i];
        const cityImage = freshCityImages[i];
        const gazinImage = freshGazinImages[i];

        await tx.frame.update({
          where: { id: frame.id },
          data: {
            projectCityImageId: cityImage.id,
            projectGazinImageId: gazinImage.id,
          },
        });

        await tx.projectCityImage.update({
          where: { id: cityImage.id },
          data: {
            status: 'USED',
          },
        });

        await tx.projectGazinImage.update({
          where: { id: gazinImage.id },
          data: {
            status: 'USED',
          },
        });
      }

      return tx.communication.findUnique({
        where: { id },
        select: this.defaultSelect(),
      });
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'COMMUNICATIONS',
      action: 'ASSIGN_IMAGES',
      entityType: 'COMMUNICATION',
      entityId: updated!.id,
      entityLabel: updated!.fullName,
      description: 'Imagens alocadas automaticamente nos quadros',
      metadata: {
        totalFrames: updated!.totalFrames,
      },
    });

    return updated;
  }

  private async createStatusHistory(params: {
    communicationId: string;
    oldStatus?: CommunicationStatus | null;
    newStatus: CommunicationStatus;
    changedById: string;
    comment?: string | null;
  }) {
    await this.prisma.communicationStatusHistory.create({
      data: {
        communicationId: params.communicationId,
        oldStatus: params.oldStatus ?? null,
        newStatus: params.newStatus,
        changedById: params.changedById,
        comment: params.comment ?? null,
      },
    });
  }

  private async reopenIfValidated(
    tx: Prisma.TransactionClient,
    communicationId: string,
    changedById: string,
    currentStatus: CommunicationStatus,
  ) {
    if (currentStatus !== 'VALIDATED') {
      return;
    }

    await tx.communication.update({
      where: { id: communicationId },
      data: {
        status: 'FINALIZED',
      },
    });

    await tx.communicationStatusHistory.create({
      data: {
        communicationId,
        oldStatus: 'VALIDATED',
        newStatus: 'FINALIZED',
        changedById,
        comment: 'Comunicacao editada apos validacao',
      },
    });
  }

  private normalizeSearch(search?: string) {
    return search?.trim().replace(/^#/, '') ?? '';
  }

  private getStatusesFromSearch(search: string): CommunicationStatus[] {
    const normalizedSearch = this.normalizeText(search);
    const statusMatchers: Array<{
      status: CommunicationStatus;
      terms: string[];
    }> = [
      {
        status: 'IN_PROGRESS',
        terms: ['in_progress', 'in progress', 'em andamento', 'andamento'],
      },
      {
        status: 'FINALIZED',
        terms: ['finalized', 'finalizada', 'finalizado'],
      },
      {
        status: 'DIVERGENT',
        terms: ['divergent', 'divergente'],
      },
      {
        status: 'VALIDATED',
        terms: ['validated', 'validada', 'validado'],
      },
    ];

    return statusMatchers
      .filter(({ status, terms }) => {
        const normalizedStatus = this.normalizeText(status);

        return (
          normalizedStatus.includes(normalizedSearch) ||
          terms.some((term) => term.includes(normalizedSearch))
        );
      })
      .map(({ status }) => status);
  }

  private normalizeText(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private async getCityLibrarySource(cityLibraryId: string) {
    const city = await this.prisma.cityLibraryCity.findUnique({
      where: { id: cityLibraryId },
      select: {
        id: true,
        name: true,
        state: true,
        fullName: true,
        photographers: {
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
            images: {
              orderBy: {
                createdAt: 'asc',
              },
              select: {
                id: true,
                imageUrl: true,
                fileName: true,
              },
            },
          },
        },
      },
    });

    if (!city) {
      throw new NotFoundException('Cidade cadastrada nÃ£o encontrada');
    }

    return city;
  }

  private buildProjectCityImagesFromCityLibrary(
    communicationId: string,
    city: Awaited<ReturnType<CommunicationsService['getCityLibrarySource']>>,
  ) {
    return city.photographers.flatMap((photographer) =>
      photographer.images.map((image) => ({
        communicationId,
        imageUrl: image.imageUrl,
        fileName: image.fileName ?? null,
        authorName: photographer.name,
        creditText: `FOTO DE AUTORIA DE: ${photographer.name.toUpperCase()}`,
        status: 'AVAILABLE' as const,
      })),
    );
  }

  private listSelect() {
    return {
      id: true,
      storeName: true,
      cityLibraryId: true,
      cityName: true,
      state: true,
      fullName: true,
      status: true,
      divergenceComment: true,
      totalWalls: true,
      totalFrames: true,
      finalizedAt: true,
      validatedAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      validatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      cityLibrary: {
        select: {
          id: true,
          name: true,
          state: true,
          fullName: true,
        },
      },
    };
  }

  private defaultSelect() {
    return {
      id: true,
      storeName: true,
      cityLibraryId: true,
      cityName: true,
      state: true,
      fullName: true,
      status: true,
      divergenceComment: true,
      totalWalls: true,
      totalFrames: true,
      finalizedAt: true,
      validatedAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      validatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      cityLibrary: {
        select: {
          id: true,
          name: true,
          state: true,
          fullName: true,
          photographers: {
            orderBy: {
              name: 'asc' as const,
            },
            select: {
              id: true,
              name: true,
              images: {
                select: {
                  id: true,
                  imageUrl: true,
                  fileName: true,
                },
              },
            },
          },
        },
      },
      walls: {
        orderBy: {
          order: 'asc' as const,
        },
        select: {
          id: true,
          name: true,
          order: true,
          createdAt: true,
          updatedAt: true,
          frames: {
            orderBy: {
              order: 'asc' as const,
            },
            select: {
              id: true,
              name: true,
              order: true,
              widthM: true,
              heightM: true,
              projectCityImageId: true,
              projectGazinImageId: true,
              cityImageZoom: true,
              cityImageOffsetX: true,
              cityImageOffsetY: true,
              gazinImageZoom: true,
              gazinImageOffsetX: true,
              gazinImageOffsetY: true,
              createdAt: true,
              updatedAt: true,
              projectCityImage: {
                select: {
                  id: true,
                  imageUrl: true,
                  fileName: true,
                  authorName: true,
                  creditText: true,
                  status: true,
                },
              },
              projectGazinImage: {
                select: {
                  id: true,
                  status: true,
                  gazinLibraryImage: {
                    select: {
                      id: true,
                      title: true,
                      description: true,
                      imageUrl: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  }
}
