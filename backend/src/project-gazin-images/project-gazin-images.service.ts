import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

type CurrentUser = {
  id: string;
  role: 'ADMIN' | 'VIP' | 'NORMAL';
};

@Injectable()
export class ProjectGazinImagesService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  async syncFromLibrary(communicationId: string, user: CurrentUser) {
    const communication = await this.prisma.communication.findUnique({
      where: { id: communicationId },
      select: {
        id: true,
        fullName: true,
        createdById: true,
      },
    });

    if (!communication) {
      throw new NotFoundException('Comunicação não encontrada');
    }

    const isOwner = communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Você não tem permissão para sincronizar imagens da Gazin nesta comunicação',
      );
    }

    const activeLibraryImages = await this.prisma.gazinLibraryImage.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });

    const existingProjectImages = await this.prisma.projectGazinImage.findMany({
      where: {
        communicationId,
      },
      select: {
        gazinLibraryImageId: true,
      },
    });

    const existingIds = new Set(
      existingProjectImages.map((item) => item.gazinLibraryImageId),
    );

    const missingImages = activeLibraryImages.filter(
      (item) => !existingIds.has(item.id),
    );

    if (missingImages.length > 0) {
      await this.prisma.projectGazinImage.createMany({
        data: missingImages.map((item) => ({
          communicationId,
          gazinLibraryImageId: item.id,
          status: 'AVAILABLE',
        })),
      });
    }

    await this.auditLogsService.create({
      userId: user.id,
      module: 'PROJECT_GAZIN_IMAGES',
      action: 'SYNC_FROM_LIBRARY',
      entityType: 'COMMUNICATION',
      entityId: communication.id,
      entityLabel: communication.fullName,
      description:
        'Imagens da Gazin sincronizadas da biblioteca para o projeto',
      metadata: {
        communicationId,
        communicationLabel: communication.fullName,
        totalAdded: missingImages.length,
        totalLibraryActiveImages: activeLibraryImages.length,
      },
    });

    return this.findAllByCommunication(communicationId);
  }

  async findAllByCommunication(communicationId: string) {
    const communication = await this.prisma.communication.findUnique({
      where: { id: communicationId },
      select: { id: true },
    });

    if (!communication) {
      throw new NotFoundException('Comunicação não encontrada');
    }

    return this.prisma.projectGazinImage.findMany({
      where: {
        communicationId,
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
    });
  }

  async remove(id: string, user: CurrentUser) {
    const item = await this.prisma.projectGazinImage.findUnique({
      where: { id },
      select: {
        id: true,
        communication: {
          select: {
            id: true,
            fullName: true,
            createdById: true,
          },
        },
        gazinLibraryImage: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Imagem da Gazin do projeto não encontrada');
    }

    const isOwner = item.communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Você não tem permissão para remover esta imagem da Gazin do projeto',
      );
    }

    await this.prisma.projectGazinImage.delete({
      where: { id },
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'PROJECT_GAZIN_IMAGES',
      action: 'DELETE',
      entityType: 'PROJECT_GAZIN_IMAGE',
      entityId: item.id,
      entityLabel: item.gazinLibraryImage.title,
      description: 'Imagem da Gazin removida do projeto',
      metadata: {
        communicationId: item.communication.id,
        communicationLabel: item.communication.fullName,
        libraryImageId: item.gazinLibraryImage.id,
        libraryImageTitle: item.gazinLibraryImage.title,
      },
    });

    return {
      message: 'Imagem da Gazin do projeto removida com sucesso',
    };
  }
}
