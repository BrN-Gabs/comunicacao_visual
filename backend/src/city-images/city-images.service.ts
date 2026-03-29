import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCityImagesDto } from './dto/create-city-images.dto';
import { UpdateCityImageDto } from './dto/update-city-image.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { deletePhysicalFileFromUrl } from '../common/upload/file-storage.utils';

type CurrentUser = {
  id: string;
  role: 'ADMIN' | 'VIP' | 'NORMAL';
};

@Injectable()
export class CityImagesService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  async createMany(
    communicationId: string,
    user: CurrentUser,
    data: CreateCityImagesDto,
  ) {
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
        'Você não tem permissão para adicionar imagens nesta comunicação',
      );
    }

    await this.prisma.projectCityImage.createMany({
      data: data.images.map((image) => ({
        communicationId,
        imageUrl: image.imageUrl,
        fileName: image.fileName ?? null,
        authorName: image.authorName,
        creditText: `FOTO DE AUTORIA DE: ${image.authorName.toUpperCase()}`,
        status: 'AVAILABLE',
      })),
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'CITY_IMAGES',
      action: 'CREATE_MANY',
      entityType: 'PROJECT_CITY_IMAGE',
      entityId: communication.id,
      entityLabel: communication.fullName,
      description: 'Imagens da cidade cadastradas em lote',
      metadata: {
        communicationId,
        communicationLabel: communication.fullName,
        totalCreated: data.images.length,
        fileNames: data.images.map((img) => img.fileName ?? null),
      },
    });

    return this.findAllByCommunication(communicationId);
  }

  async createFromUpload(
    communicationId: string,
    user: CurrentUser,
    files: Express.Multer.File[],
    authorName: string,
  ) {
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
        'Você não tem permissão para adicionar imagens nesta comunicação',
      );
    }

    await this.prisma.projectCityImage.createMany({
      data: files.map((file) => ({
        communicationId,
        imageUrl: `/uploads/city-images/${communicationId}/${file.filename}`,
        fileName: file.originalname,
        authorName,
        creditText: `FOTO DE AUTORIA DE: ${authorName.toUpperCase()}`,
        status: 'AVAILABLE',
      })),
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'CITY_IMAGES',
      action: 'UPLOAD_CREATE',
      entityType: 'PROJECT_CITY_IMAGE',
      entityId: communication.id,
      entityLabel: communication.fullName,
      description: 'Upload e criação de imagens da cidade',
      metadata: {
        totalFiles: files.length,
        authorName,
        fileNames: files.map((f) => f.originalname),
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

    return this.prisma.projectCityImage.findMany({
      where: { communicationId },
      orderBy: { createdAt: 'asc' },
      select: this.defaultSelect(),
    });
  }

  async update(id: string, user: CurrentUser, data: UpdateCityImageDto) {
    const image = await this.prisma.projectCityImage.findUnique({
      where: { id },
      select: {
        id: true,
        fileName: true,
        imageUrl: true,
        authorName: true,
        creditText: true,
        communication: {
          select: {
            id: true,
            fullName: true,
            createdById: true,
          },
        },
      },
    });

    if (!image) {
      throw new NotFoundException('Imagem da cidade não encontrada');
    }

    const isOwner = image.communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Você não tem permissão para editar esta imagem da cidade',
      );
    }

    const nextAuthorName = data.authorName;
    const nextCreditText = nextAuthorName
      ? `FOTO DE AUTORIA DE: ${nextAuthorName.toUpperCase()}`
      : undefined;

    const updated = await this.prisma.projectCityImage.update({
      where: { id },
      data: {
        ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
        ...(data.fileName !== undefined ? { fileName: data.fileName } : {}),
        ...(data.authorName ? { authorName: data.authorName } : {}),
        ...(nextCreditText ? { creditText: nextCreditText } : {}),
      },
      select: this.defaultSelect(),
    });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'CITY_IMAGES',
      action: 'UPDATE',
      entityType: 'PROJECT_CITY_IMAGE',
      entityId: updated.id,
      entityLabel: updated.fileName ?? updated.authorName,
      description: 'Imagem da cidade atualizada',
      metadata: {
        communicationId: image.communication.id,
        communicationLabel: image.communication.fullName,
        oldFileName: image.fileName,
        newFileName: updated.fileName,
        oldAuthorName: image.authorName,
        newAuthorName: updated.authorName,
        oldImageUrl: image.imageUrl,
        newImageUrl: updated.imageUrl,
      },
    });

    return updated;
  }

  async remove(id: string, user: CurrentUser) {
    const image = await this.prisma.projectCityImage.findUnique({
      where: { id },
      select: {
        id: true,
        fileName: true,
        imageUrl: true,
        authorName: true,
        communication: {
          select: {
            id: true,
            fullName: true,
            createdById: true,
          },
        },
      },
    });

    if (!image) {
      throw new NotFoundException('Imagem da cidade não encontrada');
    }

    const isOwner = image.communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Você não tem permissão para excluir esta imagem da cidade',
      );
    }

    await this.prisma.projectCityImage.delete({
      where: { id },
    });

    deletePhysicalFileFromUrl(image.imageUrl);

    await this.auditLogsService.create({
      userId: user.id,
      module: 'CITY_IMAGES',
      action: 'DELETE',
      entityType: 'PROJECT_CITY_IMAGE',
      entityId: image.id,
      entityLabel: image.fileName ?? image.authorName,
      description: 'Imagem da cidade removida',
      metadata: {
        communicationId: image.communication.id,
        communicationLabel: image.communication.fullName,
        fileName: image.fileName,
        authorName: image.authorName,
        imageUrl: image.imageUrl,
      },
    });

    return {
      message: 'Imagem da cidade removida com sucesso',
    };
  }

  async reupload(
    communicationId: string,
    id: string,
    user: CurrentUser,
    file: Express.Multer.File,
  ) {
    const image = await this.prisma.projectCityImage.findUnique({
      where: { id },
      select: {
        id: true,
        imageUrl: true,
        fileName: true,
        communication: {
          select: {
            id: true,
            fullName: true,
            createdById: true,
          },
        },
      },
    });

    if (!image) {
      throw new NotFoundException('Imagem da cidade não encontrada');
    }

    if (image.communication.id !== communicationId) {
      throw new ForbiddenException('Comunicação inválida');
    }

    const isOwner = image.communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar esta imagem',
      );
    }

    const oldUrl = image.imageUrl;

    const newUrl = `/uploads/city-images/${communicationId}/${file.filename}`;

    const updated = await this.prisma.projectCityImage.update({
      where: { id },
      data: {
        imageUrl: newUrl,
        fileName: file.originalname,
      },
      select: this.defaultSelect(),
    });

    // remove arquivo antigo
    deletePhysicalFileFromUrl(oldUrl);

    await this.auditLogsService.create({
      userId: user.id,
      module: 'CITY_IMAGES',
      action: 'REUPLOAD',
      entityType: 'PROJECT_CITY_IMAGE',
      entityId: updated.id,
      entityLabel: updated.fileName ?? updated.authorName,
      description: 'Imagem da cidade substituída',
      metadata: {
        oldUrl,
        newUrl,
        originalFileName: file.originalname,
      },
    });

    return updated;
  }

  private defaultSelect() {
    return {
      id: true,
      communicationId: true,
      imageUrl: true,
      fileName: true,
      authorName: true,
      creditText: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
