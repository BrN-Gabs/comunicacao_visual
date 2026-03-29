import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UpdateFrameImageLayoutDto } from './dto/update-frame-image-layout.dto';

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
export class FramesService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  async swapCityImage(
    frameId: string,
    user: CurrentUser,
    targetProjectCityImageId: string,
  ) {
    const frame = await this.prisma.frame.findUnique({
      where: { id: frameId },
      select: {
        id: true,
        name: true,
        projectCityImageId: true,
        wall: {
          select: {
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
        },
      },
    });

    if (!frame) {
      throw new NotFoundException('Quadro nÃ£o encontrado');
    }

    const communication = frame.wall.communication;
    const isOwner = communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'VocÃª nÃ£o tem permissÃ£o para trocar a imagem da cidade deste quadro',
      );
    }

    const targetImage = await this.prisma.projectCityImage.findUnique({
      where: { id: targetProjectCityImageId },
      select: {
        id: true,
        fileName: true,
        authorName: true,
        communicationId: true,
      },
    });

    if (!targetImage) {
      throw new NotFoundException('Imagem da cidade nÃ£o encontrada');
    }

    if (targetImage.communicationId !== communication.id) {
      throw new ForbiddenException(
        'A imagem da cidade escolhida nÃ£o pertence a esta comunicaÃ§Ã£o',
      );
    }

    const targetFrame = await this.prisma.frame.findFirst({
      where: {
        wall: {
          communicationId: communication.id,
        },
        projectCityImageId: targetProjectCityImageId,
      },
      select: {
        id: true,
        name: true,
        projectCityImageId: true,
      },
    });

    const updatedFrame = await this.prisma.$transaction(async (tx) => {
      const currentImageId = frame.projectCityImageId;

      if (targetFrame && targetFrame.id !== frame.id) {
        await tx.frame.update({
          where: { id: frame.id },
          data: {
            projectCityImageId: targetProjectCityImageId,
            cityImageZoom: 1,
            cityImageOffsetX: 0,
            cityImageOffsetY: 0,
          },
        });

        await tx.frame.update({
          where: { id: targetFrame.id },
          data: {
            projectCityImageId: currentImageId ?? null,
            cityImageZoom: 1,
            cityImageOffsetX: 0,
            cityImageOffsetY: 0,
          },
        });

        if (currentImageId) {
          await tx.projectCityImage.update({
            where: { id: currentImageId },
            data: { status: 'USED' },
          });
        }

        await tx.projectCityImage.update({
          where: { id: targetProjectCityImageId },
          data: { status: 'USED' },
        });
      } else {
        await tx.frame.update({
          where: { id: frame.id },
          data: {
            projectCityImageId: targetProjectCityImageId,
            cityImageZoom: 1,
            cityImageOffsetX: 0,
            cityImageOffsetY: 0,
          },
        });

        await tx.projectCityImage.update({
          where: { id: targetProjectCityImageId },
          data: { status: 'USED' },
        });

        if (currentImageId && currentImageId !== targetProjectCityImageId) {
          await tx.projectCityImage.update({
            where: { id: currentImageId },
            data: { status: 'AVAILABLE' },
          });
        }
      }

      await this.reopenIfValidated(
        tx,
        communication.id,
        user.id,
        communication.status,
      );

      return tx.frame.findUnique({
        where: { id: frame.id },
        select: this.frameSelect(),
      });
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'FRAMES',
      action: 'SWAP_CITY_IMAGE',
      entityType: 'FRAME',
      entityId: frame.id,
      entityLabel: `${communication.fullName} / ${frame.wall.name} / ${frame.name}`,
      description: 'Imagem da cidade trocada no quadro',
      metadata: {
        communicationId: communication.id,
        communicationLabel: communication.fullName,
        wallName: frame.wall.name,
        frameName: frame.name,
        targetProjectCityImageId,
        targetImageFileName: targetImage.fileName,
        targetImageAuthorName: targetImage.authorName,
        swapType:
          targetFrame && targetFrame.id !== frame.id
            ? 'FRAME_SWAP'
            : 'AVAILABLE_REPLACE',
      },
    });

    return updatedFrame;
  }

  async swapGazinImage(
    frameId: string,
    user: CurrentUser,
    targetProjectGazinImageId: string,
  ) {
    const frame = await this.prisma.frame.findUnique({
      where: { id: frameId },
      select: {
        id: true,
        name: true,
        projectGazinImageId: true,
        wall: {
          select: {
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
        },
      },
    });

    if (!frame) {
      throw new NotFoundException('Quadro nÃ£o encontrado');
    }

    const communication = frame.wall.communication;
    const isOwner = communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'VocÃª nÃ£o tem permissÃ£o para trocar a imagem da Gazin deste quadro',
      );
    }

    const targetImage = await this.prisma.projectGazinImage.findUnique({
      where: { id: targetProjectGazinImageId },
      select: {
        id: true,
        communicationId: true,
        gazinLibraryImage: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
    });

    if (!targetImage) {
      throw new NotFoundException('Imagem da Gazin nÃ£o encontrada');
    }

    if (targetImage.communicationId !== communication.id) {
      throw new ForbiddenException(
        'A imagem da Gazin escolhida nÃ£o pertence a esta comunicaÃ§Ã£o',
      );
    }

    const targetFrame = await this.prisma.frame.findFirst({
      where: {
        wall: {
          communicationId: communication.id,
        },
        projectGazinImageId: targetProjectGazinImageId,
      },
      select: {
        id: true,
        name: true,
        projectGazinImageId: true,
      },
    });

    const updatedFrame = await this.prisma.$transaction(async (tx) => {
      const currentImageId = frame.projectGazinImageId;

      if (targetFrame && targetFrame.id !== frame.id) {
        await tx.frame.update({
          where: { id: frame.id },
          data: {
            projectGazinImageId: targetProjectGazinImageId,
            gazinImageZoom: 1,
            gazinImageOffsetX: 0,
            gazinImageOffsetY: 0,
          },
        });

        await tx.frame.update({
          where: { id: targetFrame.id },
          data: {
            projectGazinImageId: currentImageId ?? null,
            gazinImageZoom: 1,
            gazinImageOffsetX: 0,
            gazinImageOffsetY: 0,
          },
        });

        if (currentImageId) {
          await tx.projectGazinImage.update({
            where: { id: currentImageId },
            data: { status: 'USED' },
          });
        }

        await tx.projectGazinImage.update({
          where: { id: targetProjectGazinImageId },
          data: { status: 'USED' },
        });
      } else {
        await tx.frame.update({
          where: { id: frame.id },
          data: {
            projectGazinImageId: targetProjectGazinImageId,
            gazinImageZoom: 1,
            gazinImageOffsetX: 0,
            gazinImageOffsetY: 0,
          },
        });

        await tx.projectGazinImage.update({
          where: { id: targetProjectGazinImageId },
          data: { status: 'USED' },
        });

        if (currentImageId && currentImageId !== targetProjectGazinImageId) {
          await tx.projectGazinImage.update({
            where: { id: currentImageId },
            data: { status: 'AVAILABLE' },
          });
        }
      }

      await this.reopenIfValidated(
        tx,
        communication.id,
        user.id,
        communication.status,
      );

      return tx.frame.findUnique({
        where: { id: frame.id },
        select: this.frameSelect(),
      });
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'FRAMES',
      action: 'SWAP_GAZIN_IMAGE',
      entityType: 'FRAME',
      entityId: frame.id,
      entityLabel: `${communication.fullName} / ${frame.wall.name} / ${frame.name}`,
      description: 'Imagem da Gazin trocada no quadro',
      metadata: {
        communicationId: communication.id,
        communicationLabel: communication.fullName,
        wallName: frame.wall.name,
        frameName: frame.name,
        targetProjectGazinImageId,
        targetLibraryImageId: targetImage.gazinLibraryImage.id,
        targetLibraryImageTitle: targetImage.gazinLibraryImage.title,
        swapType:
          targetFrame && targetFrame.id !== frame.id
            ? 'FRAME_SWAP'
            : 'AVAILABLE_REPLACE',
      },
    });

    return updatedFrame;
  }

  async updateDimensions(
    frameId: string,
    user: CurrentUser,
    widthM: number,
    heightM: number,
  ) {
    const frame = await this.prisma.frame.findUnique({
      where: { id: frameId },
      select: {
        id: true,
        name: true,
        widthM: true,
        heightM: true,
        wall: {
          select: {
            name: true,
            communication: {
              select: {
                id: true,
                fullName: true,
                createdById: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!frame) {
      throw new NotFoundException('Quadro nÃ£o encontrado');
    }

    const communication = frame.wall.communication;
    const isOwner = communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'VocÃª nÃ£o tem permissÃ£o para editar as medidas deste quadro',
      );
    }

    const updatedFrame = await this.prisma.$transaction(async (tx) => {
      const result = await tx.frame.update({
        where: { id: frameId },
        data: {
          widthM,
          heightM,
        },
        select: this.frameSelect(),
      });

      await this.reopenIfValidated(
        tx,
        communication.id,
        user.id,
        communication.status,
      );

      return result;
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'FRAMES',
      action: 'UPDATE_DIMENSIONS',
      entityType: 'FRAME',
      entityId: frame.id,
      entityLabel: `${communication.fullName} / ${frame.wall.name} / ${frame.name}`,
      description: 'DimensÃµes do quadro atualizadas',
      metadata: {
        communicationId: communication.id,
        communicationLabel: communication.fullName,
        wallName: frame.wall.name,
        frameName: frame.name,
        oldWidthM: frame.widthM,
        oldHeightM: frame.heightM,
        newWidthM: widthM,
        newHeightM: heightM,
      },
    });

    return updatedFrame;
  }

  async updateImageLayout(
    frameId: string,
    user: CurrentUser,
    layout: UpdateFrameImageLayoutDto,
  ) {
    const frame = await this.prisma.frame.findUnique({
      where: { id: frameId },
      select: {
        id: true,
        name: true,
        cityImageZoom: true,
        cityImageOffsetX: true,
        cityImageOffsetY: true,
        gazinImageZoom: true,
        gazinImageOffsetX: true,
        gazinImageOffsetY: true,
        wall: {
          select: {
            name: true,
            communication: {
              select: {
                id: true,
                fullName: true,
                createdById: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!frame) {
      throw new NotFoundException('Quadro nÃƒÂ£o encontrado');
    }

    const communication = frame.wall.communication;
    const isOwner = communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'VocÃƒÂª nÃƒÂ£o tem permissÃƒÂ£o para editar o enquadramento deste quadro',
      );
    }

    const updatedFrame = await this.prisma.$transaction(async (tx) => {
      const result = await tx.frame.update({
        where: { id: frameId },
        data: {
          cityImageZoom: layout.cityImageZoom,
          cityImageOffsetX: layout.cityImageOffsetX,
          cityImageOffsetY: layout.cityImageOffsetY,
          gazinImageZoom: layout.gazinImageZoom,
          gazinImageOffsetX: layout.gazinImageOffsetX,
          gazinImageOffsetY: layout.gazinImageOffsetY,
        },
        select: this.frameSelect(),
      });

      await this.reopenIfValidated(
        tx,
        communication.id,
        user.id,
        communication.status,
      );

      return result;
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'FRAMES',
      action: 'UPDATE_IMAGE_LAYOUT',
      entityType: 'FRAME',
      entityId: frame.id,
      entityLabel: `${communication.fullName} / ${frame.wall.name} / ${frame.name}`,
      description: 'Enquadramento das imagens do quadro atualizado',
      metadata: {
        communicationId: communication.id,
        communicationLabel: communication.fullName,
        wallName: frame.wall.name,
        frameName: frame.name,
        oldCityImageZoom: frame.cityImageZoom,
        oldCityImageOffsetX: frame.cityImageOffsetX,
        oldCityImageOffsetY: frame.cityImageOffsetY,
        oldGazinImageZoom: frame.gazinImageZoom,
        oldGazinImageOffsetX: frame.gazinImageOffsetX,
        oldGazinImageOffsetY: frame.gazinImageOffsetY,
        ...layout,
      },
    });

    return updatedFrame;
  }

  async remove(frameId: string, user: CurrentUser) {
    const frame = await this.prisma.frame.findUnique({
      where: { id: frameId },
      select: {
        id: true,
        name: true,
        projectCityImageId: true,
        projectGazinImageId: true,
        wall: {
          select: {
            id: true,
            name: true,
            communication: {
              select: {
                id: true,
                fullName: true,
                createdById: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!frame) {
      throw new NotFoundException('Quadro nao encontrado');
    }

    const communication = frame.wall.communication;
    const isOwner = communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Voce nao tem permissao para excluir este quadro',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.frame.delete({
        where: { id: frameId },
      });

      if (frame.projectCityImageId) {
        const remainingCityAssignments = await tx.frame.count({
          where: {
            projectCityImageId: frame.projectCityImageId,
          },
        });

        await tx.projectCityImage.update({
          where: { id: frame.projectCityImageId },
          data: {
            status: remainingCityAssignments > 0 ? 'USED' : 'AVAILABLE',
          },
        });
      }

      if (frame.projectGazinImageId) {
        const remainingGazinAssignments = await tx.frame.count({
          where: {
            projectGazinImageId: frame.projectGazinImageId,
          },
        });

        await tx.projectGazinImage.update({
          where: { id: frame.projectGazinImageId },
          data: {
            status: remainingGazinAssignments > 0 ? 'USED' : 'AVAILABLE',
          },
        });
      }

      const totalFrames = await tx.frame.count({
        where: {
          wall: {
            communicationId: communication.id,
          },
        },
      });

      const totalWalls = await tx.wall.count({
        where: {
          communicationId: communication.id,
        },
      });

      await tx.communication.update({
        where: { id: communication.id },
        data: {
          totalFrames,
          totalWalls,
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
      module: 'FRAMES',
      action: 'DELETE',
      entityType: 'FRAME',
      entityId: frame.id,
      entityLabel: `${communication.fullName} / ${frame.wall.name} / ${frame.name}`,
      description: 'Quadro removido',
      metadata: {
        communicationId: communication.id,
        communicationLabel: communication.fullName,
        wallId: frame.wall.id,
        wallName: frame.wall.name,
        frameName: frame.name,
      },
    });

    return {
      message: 'Quadro removido com sucesso',
    };
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
        comment: 'ComunicaÃ§Ã£o editada apÃ³s validaÃ§Ã£o',
      },
    });
  }

  private frameSelect() {
    return {
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
      wall: {
        select: {
          id: true,
          name: true,
          order: true,
          communicationId: true,
        },
      },
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
    };
  }
}
