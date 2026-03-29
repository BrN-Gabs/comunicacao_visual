import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGazinLibraryImageDto } from './dto/create-gazin-library-image.dto';
import { UpdateGazinLibraryImageDto } from './dto/update-gazin-library-image.dto';
import { UpdateGazinLibraryImageStatusDto } from './dto/update-gazin-library-image-status.dto';
import { FilterGazinLibraryImagesDto } from './dto/filter-gazin-library-images.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { deletePhysicalFileFromUrl } from '../common/upload/file-storage.utils';

@Injectable()
export class GazinLibraryService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(userId: string, data: CreateGazinLibraryImageDto) {
    const created = await this.prisma.gazinLibraryImage.create({
      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        createdById: userId,
      },
      select: this.defaultSelect(),
    });

    await this.auditLogsService.create({
      userId,
      module: 'GAZIN_LIBRARY',
      action: 'CREATE',
      entityType: 'GAZIN_LIBRARY_IMAGE',
      entityId: created.id,
      entityLabel: created.title,
      description: 'Imagem da Gazin cadastrada',
      metadata: {
        title: created.title,
        status: created.status,
      },
    });

    return created;
  }

  async createFromUpload(
    userId: string,
    file: Express.Multer.File,
    title: string,
    description: string,
  ) {
    const created = await this.prisma.gazinLibraryImage.create({
      data: {
        title,
        description,
        imageUrl: `/uploads/gazin-library/${file.filename}`,
        createdById: userId,
      },
      select: this.defaultSelect(),
    });

    await this.auditLogsService.create({
      userId,
      module: 'GAZIN_LIBRARY',
      action: 'UPLOAD_CREATE',
      entityType: 'GAZIN_LIBRARY_IMAGE',
      entityId: created.id,
      entityLabel: created.title,
      description: 'Imagem da Gazin enviada por upload e cadastrada',
      metadata: {
        title: created.title,
        description: created.description,
        imageUrl: created.imageUrl,
        originalFileName: file.originalname,
        storedFileName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
      },
    });

    return created;
  }

  async findAll(filters: FilterGazinLibraryImagesDto) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 10;
    const skip = (page - 1) * limit;

    const where = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                title: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                description: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.gazinLibraryImage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: this.defaultSelect(),
      }),
      this.prisma.gazinLibraryImage.count({ where }),
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
    const item = await this.prisma.gazinLibraryImage.findUnique({
      where: { id },
      select: this.defaultSelect(),
    });

    if (!item) {
      throw new NotFoundException('Imagem da Gazin não encontrada');
    }

    return item;
  }

  async update(id: string, userId: string, data: UpdateGazinLibraryImageDto) {
    const existing = await this.prisma.gazinLibraryImage.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Imagem da Gazin não encontrada');
    }

    const updated = await this.prisma.gazinLibraryImage.update({
      where: { id },
      data,
      select: this.defaultSelect(),
    });

    await this.auditLogsService.create({
      userId,
      module: 'GAZIN_LIBRARY',
      action: 'UPDATE',
      entityType: 'GAZIN_LIBRARY_IMAGE',
      entityId: updated.id,
      entityLabel: updated.title,
      description: 'Imagem da Gazin atualizada',
      metadata: {
        oldTitle: existing.title,
        newTitle: updated.title,
        oldDescription: existing.description,
        newDescription: updated.description,
        oldImageUrl: existing.imageUrl,
        newImageUrl: updated.imageUrl,
      },
    });

    return updated;
  }

  async updateStatus(
    id: string,
    userId: string,
    data: UpdateGazinLibraryImageStatusDto,
  ) {
    const existing = await this.prisma.gazinLibraryImage.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Imagem da Gazin não encontrada');
    }

    const updated = await this.prisma.gazinLibraryImage.update({
      where: { id },
      data: {
        status: data.status,
      },
      select: this.defaultSelect(),
    });

    await this.auditLogsService.create({
      userId,
      module: 'GAZIN_LIBRARY',
      action: 'UPDATE_STATUS',
      entityType: 'GAZIN_LIBRARY_IMAGE',
      entityId: updated.id,
      entityLabel: updated.title,
      description: 'Status da imagem da Gazin atualizado',
      metadata: {
        oldStatus: existing.status,
        newStatus: updated.status,
      },
    });

    return updated;
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.gazinLibraryImage.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Imagem da Gazin não encontrada');
    }

    const linkedProjectImages = await this.prisma.projectGazinImage.count({
      where: {
        gazinLibraryImageId: id,
      },
    });

    if (linkedProjectImages > 0) {
      throw new BadRequestException(
        `Não e possível excluir a imagem da Gazin porque ela ja está vinculada a ${linkedProjectImages} ${linkedProjectImages === 1 ? 'comunicação visual' : 'comunicações visuais'}. Inative a imagem para impedir novos usos.`,
      );
    }

    await this.prisma.gazinLibraryImage.delete({
      where: { id },
    });

    deletePhysicalFileFromUrl(existing.imageUrl);

    await this.auditLogsService.create({
      userId,
      module: 'GAZIN_LIBRARY',
      action: 'DELETE',
      entityType: 'GAZIN_LIBRARY_IMAGE',
      entityId: existing.id,
      entityLabel: existing.title,
      description: 'Imagem da Gazin removida',
      metadata: {
        title: existing.title,
        description: existing.description,
        status: existing.status,
        imageUrl: existing.imageUrl,
      },
    });

    return {
      message: 'Imagem da Gazin removida com sucesso',
    };
  }

  async countActive() {
    return this.prisma.gazinLibraryImage.count({
      where: {
        status: 'ACTIVE',
      },
    });
  }

  async reupload(id: string, userId: string, file: Express.Multer.File) {
    const existing = await this.prisma.gazinLibraryImage.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        imageUrl: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Imagem da Gazin não encontrada');
    }

    const oldUrl = existing.imageUrl;
    const newUrl = `/uploads/gazin-library/${file.filename}`;

    const updated = await this.prisma.gazinLibraryImage.update({
      where: { id },
      data: {
        imageUrl: newUrl,
      },
      select: this.defaultSelect(),
    });

    deletePhysicalFileFromUrl(oldUrl);

    await this.auditLogsService.create({
      userId,
      module: 'GAZIN_LIBRARY',
      action: 'REUPLOAD',
      entityType: 'GAZIN_LIBRARY_IMAGE',
      entityId: updated.id,
      entityLabel: updated.title,
      description: 'Imagem da Gazin substituída',
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
      title: true,
      description: true,
      imageUrl: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    };
  }
}
