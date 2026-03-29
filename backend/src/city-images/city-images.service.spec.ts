import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCityImagesDto } from './dto/create-city-images.dto';
import { UpdateCityImageDto } from './dto/update-city-image.dto';

type CurrentUser = {
  id: string;
  role: 'ADMIN' | 'VIP' | 'NORMAL';
};

@Injectable()
export class CityImagesService {
  constructor(private prisma: PrismaService) {}

  async createMany(
    communicationId: string,
    user: CurrentUser,
    data: CreateCityImagesDto,
  ) {
    const communication = await this.prisma.communication.findUnique({
      where: { id: communicationId },
      select: {
        id: true,
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

    await this.prisma.communicationCityImage.createMany({
      data: data.images.map((image) => ({
        communicationId,
        imageUrl: image.imageUrl,
        fileName: image.fileName ?? null,
        authorName: image.authorName,
        creditText: `FOTO DE AUTORIA DE: ${image.authorName.toUpperCase()}`,
        status: 'AVAILABLE',
      })),
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

    return this.prisma.communicationCityImage.findMany({
      where: { communicationId },
      orderBy: { createdAt: 'asc' },
      select: this.defaultSelect(),
    });
  }

  async update(id: string, user: CurrentUser, data: UpdateCityImageDto) {
    const image = await this.prisma.communicationCityImage.findUnique({
      where: { id },
      select: {
        id: true,
        communication: {
          select: {
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

    return this.prisma.communicationCityImage.update({
      where: { id },
      data: {
        ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
        ...(data.fileName !== undefined ? { fileName: data.fileName } : {}),
        ...(data.authorName ? { authorName: data.authorName } : {}),
        ...(nextCreditText ? { creditText: nextCreditText } : {}),
      },
      select: this.defaultSelect(),
    });
  }

  async remove(id: string, user: CurrentUser) {
    const image = await this.prisma.communicationCityImage.findUnique({
      where: { id },
      select: {
        id: true,
        communication: {
          select: {
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

    await this.prisma.communicationCityImage.delete({
      where: { id },
    });

    return {
      message: 'Imagem da cidade removida com sucesso',
    };
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
