import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FilterCityLibraryCitiesDto } from './dto/filter-city-library-cities.dto';
import { CreateCityLibraryCityDto } from './dto/create-city-library-city.dto';
import { UpdateCityLibraryCityDto } from './dto/update-city-library-city.dto';
import { CreateCityPhotographerDto } from './dto/create-city-photographer.dto';
import { UpdateCityPhotographerDto } from './dto/update-city-photographer.dto';
import { deletePhysicalFileFromUrl } from '../common/upload/file-storage.utils';

@Injectable()
export class CityLibraryService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  async findAllCities(filters: FilterCityLibraryCitiesDto) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;
    const skip = (page - 1) * limit;
    const search = filters.search?.trim();

    const where = search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
            {
              fullName: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
            {
              state: {
                contains: search.toUpperCase(),
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.cityLibraryCity.findMany({
        where,
        orderBy: [{ name: 'asc' }, { state: 'asc' }],
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          state: true,
          fullName: true,
          createdAt: true,
          updatedAt: true,
          photographers: {
            select: {
              id: true,
              _count: {
                select: {
                  images: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.cityLibraryCity.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        state: item.state,
        fullName: item.fullName,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        photographersCount: item.photographers.length,
        imagesCount: item.photographers.reduce(
          (totalImages, photographer) =>
            totalImages + photographer._count.images,
          0,
        ),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findCity(id: string) {
    const city = await this.prisma.cityLibraryCity.findUnique({
      where: { id },
      select: this.cityDetailSelect(),
    });

    if (!city) {
      throw new NotFoundException('Cidade nÃ£o encontrada');
    }

    return {
      ...city,
      photographersCount: city.photographers.length,
      imagesCount: city.photographers.reduce(
        (totalImages, photographer) => totalImages + photographer.images.length,
        0,
      ),
    };
  }

  async createCity(userId: string, data: CreateCityLibraryCityDto) {
    const normalizedName = data.name.trim();
    const normalizedState = data.state.trim().toUpperCase();

    await this.ensureCityUnique(normalizedName, normalizedState);

    const created = await this.prisma.cityLibraryCity.create({
      data: {
        name: normalizedName,
        state: normalizedState,
        fullName: this.buildCityFullName(normalizedName, normalizedState),
      },
      select: this.cityDetailSelect(),
    });

    await this.auditLogsService.create({
      userId,
      module: 'CITY_LIBRARY',
      action: 'CREATE_CITY',
      entityType: 'CITY_LIBRARY_CITY',
      entityId: created.id,
      entityLabel: created.fullName,
      description: 'Cidade cadastrada na biblioteca de fotos',
      metadata: {
        cityName: created.name,
        state: created.state,
      },
    });

    return {
      ...created,
      photographersCount: 0,
      imagesCount: 0,
    };
  }

  async updateCity(id: string, userId: string, data: UpdateCityLibraryCityDto) {
    const existing = await this.prisma.cityLibraryCity.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        state: true,
        fullName: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Cidade nÃ£o encontrada');
    }

    const normalizedName = data.name.trim();
    const normalizedState = data.state.trim().toUpperCase();

    await this.ensureCityUnique(normalizedName, normalizedState, id);

    const updated = await this.prisma.cityLibraryCity.update({
      where: { id },
      data: {
        name: normalizedName,
        state: normalizedState,
        fullName: this.buildCityFullName(normalizedName, normalizedState),
      },
      select: this.cityDetailSelect(),
    });

    await this.auditLogsService.create({
      userId,
      module: 'CITY_LIBRARY',
      action: 'UPDATE_CITY',
      entityType: 'CITY_LIBRARY_CITY',
      entityId: updated.id,
      entityLabel: updated.fullName,
      description: 'Cidade atualizada na biblioteca de fotos',
      metadata: {
        oldName: existing.name,
        newName: updated.name,
        oldState: existing.state,
        newState: updated.state,
        oldFullName: existing.fullName,
        newFullName: updated.fullName,
      },
    });

    return {
      ...updated,
      photographersCount: updated.photographers.length,
      imagesCount: updated.photographers.reduce(
        (totalImages, photographer) => totalImages + photographer.images.length,
        0,
      ),
    };
  }

  async removeCity(id: string, userId: string) {
    const existing = await this.prisma.cityLibraryCity.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        photographers: {
          select: {
            id: true,
            name: true,
            images: {
              select: {
                id: true,
                imageUrl: true,
              },
            },
          },
        },
        communications: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Cidade nÃ£o encontrada');
    }

    await this.prisma.cityLibraryCity.delete({
      where: { id },
    });

    for (const photographer of existing.photographers) {
      for (const image of photographer.images) {
        deletePhysicalFileFromUrl(image.imageUrl);
      }
    }

    await this.auditLogsService.create({
      userId,
      module: 'CITY_LIBRARY',
      action: 'DELETE_CITY',
      entityType: 'CITY_LIBRARY_CITY',
      entityId: existing.id,
      entityLabel: existing.fullName,
      description: 'Cidade removida da biblioteca de fotos',
      metadata: {
        photographersCount: existing.photographers.length,
        imagesCount: existing.photographers.reduce(
          (totalImages, photographer) =>
            totalImages + photographer.images.length,
          0,
        ),
        linkedCommunications: existing.communications.length,
      },
    });

    return {
      message: 'Cidade removida com sucesso',
    };
  }

  async createPhotographer(
    cityId: string,
    userId: string,
    data: CreateCityPhotographerDto,
  ) {
    const city = await this.prisma.cityLibraryCity.findUnique({
      where: { id: cityId },
      select: {
        id: true,
        fullName: true,
      },
    });

    if (!city) {
      throw new NotFoundException('Cidade nÃ£o encontrada');
    }

    const normalizedName = data.name.trim();
    await this.ensurePhotographerUnique(cityId, normalizedName);

    const created = await this.prisma.cityPhotographer.create({
      data: {
        cityId,
        name: normalizedName,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        images: {
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            imageUrl: true,
            fileName: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    await this.auditLogsService.create({
      userId,
      module: 'CITY_LIBRARY',
      action: 'CREATE_PHOTOGRAPHER',
      entityType: 'CITY_PHOTOGRAPHER',
      entityId: created.id,
      entityLabel: created.name,
      description: 'FotÃ³grafo cadastrado para a cidade',
      metadata: {
        cityId,
        cityLabel: city.fullName,
        photographerName: created.name,
      },
    });

    return created;
  }

  async updatePhotographer(
    id: string,
    userId: string,
    data: UpdateCityPhotographerDto,
  ) {
    const existing = await this.prisma.cityPhotographer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        city: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('FotÃ³grafo nÃ£o encontrado');
    }

    const normalizedName = data.name.trim();
    await this.ensurePhotographerUnique(existing.city.id, normalizedName, id);

    const updated = await this.prisma.cityPhotographer.update({
      where: { id },
      data: {
        name: normalizedName,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        images: {
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            imageUrl: true,
            fileName: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    await this.auditLogsService.create({
      userId,
      module: 'CITY_LIBRARY',
      action: 'UPDATE_PHOTOGRAPHER',
      entityType: 'CITY_PHOTOGRAPHER',
      entityId: updated.id,
      entityLabel: updated.name,
      description: 'FotÃ³grafo atualizado na biblioteca da cidade',
      metadata: {
        cityId: existing.city.id,
        cityLabel: existing.city.fullName,
        oldName: existing.name,
        newName: updated.name,
      },
    });

    return updated;
  }

  async removePhotographer(id: string, userId: string) {
    const existing = await this.prisma.cityPhotographer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        city: {
          select: {
            id: true,
            fullName: true,
          },
        },
        images: {
          select: {
            id: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('FotÃ³grafo nÃ£o encontrado');
    }

    await this.prisma.cityPhotographer.delete({
      where: { id },
    });

    for (const image of existing.images) {
      deletePhysicalFileFromUrl(image.imageUrl);
    }

    await this.auditLogsService.create({
      userId,
      module: 'CITY_LIBRARY',
      action: 'DELETE_PHOTOGRAPHER',
      entityType: 'CITY_PHOTOGRAPHER',
      entityId: existing.id,
      entityLabel: existing.name,
      description: 'FotÃ³grafo removido da biblioteca da cidade',
      metadata: {
        cityId: existing.city.id,
        cityLabel: existing.city.fullName,
        imagesCount: existing.images.length,
      },
    });

    return {
      message: 'FotÃ³grafo removido com sucesso',
    };
  }

  async uploadPhotographerImages(
    photographerId: string,
    userId: string,
    files: Express.Multer.File[],
  ) {
    const photographer = await this.prisma.cityPhotographer.findUnique({
      where: { id: photographerId },
      select: {
        id: true,
        name: true,
        city: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!photographer) {
      throw new NotFoundException('FotÃ³grafo nÃ£o encontrado');
    }

    if (!files.length) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    await this.prisma.cityLibraryImage.createMany({
      data: files.map((file) => ({
        photographerId,
        imageUrl: `/uploads/city-library/${photographerId}/${file.filename}`,
        fileName: file.originalname,
      })),
    });

    await this.auditLogsService.create({
      userId,
      module: 'CITY_LIBRARY',
      action: 'UPLOAD_IMAGES',
      entityType: 'CITY_PHOTOGRAPHER',
      entityId: photographer.id,
      entityLabel: photographer.name,
      description: 'Imagens cadastradas para o fotÃ³grafo',
      metadata: {
        cityId: photographer.city.id,
        cityLabel: photographer.city.fullName,
        totalFiles: files.length,
        fileNames: files.map((file) => file.originalname),
      },
    });

    return this.findCity(photographer.city.id);
  }

  async reuploadImage(id: string, userId: string, file: Express.Multer.File) {
    const existing = await this.prisma.cityLibraryImage.findUnique({
      where: { id },
      select: {
        id: true,
        fileName: true,
        imageUrl: true,
        photographer: {
          select: {
            id: true,
            name: true,
            city: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Imagem da cidade nÃ£o encontrada');
    }

    const oldUrl = existing.imageUrl;
    const newUrl = `/uploads/city-library/${existing.photographer.id}/${file.filename}`;

    const updated = await this.prisma.cityLibraryImage.update({
      where: { id },
      data: {
        imageUrl: newUrl,
        fileName: file.originalname,
      },
      select: {
        id: true,
        imageUrl: true,
        fileName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    deletePhysicalFileFromUrl(oldUrl);

    await this.auditLogsService.create({
      userId,
      module: 'CITY_LIBRARY',
      action: 'REUPLOAD_IMAGE',
      entityType: 'CITY_LIBRARY_IMAGE',
      entityId: updated.id,
      entityLabel: updated.fileName ?? existing.fileName ?? updated.id,
      description: 'Imagem da cidade substituÃ­da',
      metadata: {
        cityId: existing.photographer.city.id,
        cityLabel: existing.photographer.city.fullName,
        photographerId: existing.photographer.id,
        photographerName: existing.photographer.name,
        oldUrl,
        newUrl,
        fileName: file.originalname,
      },
    });

    return updated;
  }

  async removeImage(id: string, userId: string) {
    const existing = await this.prisma.cityLibraryImage.findUnique({
      where: { id },
      select: {
        id: true,
        fileName: true,
        imageUrl: true,
        photographer: {
          select: {
            id: true,
            name: true,
            city: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Imagem da cidade nÃ£o encontrada');
    }

    await this.prisma.cityLibraryImage.delete({
      where: { id },
    });

    deletePhysicalFileFromUrl(existing.imageUrl);

    await this.auditLogsService.create({
      userId,
      module: 'CITY_LIBRARY',
      action: 'DELETE_IMAGE',
      entityType: 'CITY_LIBRARY_IMAGE',
      entityId: existing.id,
      entityLabel: existing.fileName ?? existing.id,
      description: 'Imagem removida da biblioteca da cidade',
      metadata: {
        cityId: existing.photographer.city.id,
        cityLabel: existing.photographer.city.fullName,
        photographerId: existing.photographer.id,
        photographerName: existing.photographer.name,
        imageUrl: existing.imageUrl,
      },
    });

    return {
      message: 'Imagem removida com sucesso',
    };
  }

  private cityDetailSelect() {
    return {
      id: true,
      name: true,
      state: true,
      fullName: true,
      createdAt: true,
      updatedAt: true,
      photographers: {
        orderBy: {
          name: 'asc' as const,
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          images: {
            orderBy: {
              createdAt: 'desc' as const,
            },
            select: {
              id: true,
              imageUrl: true,
              fileName: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    };
  }

  private buildCityFullName(name: string, state: string) {
    return `${name} - ${state}`;
  }

  private async ensureCityUnique(
    name: string,
    state: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.cityLibraryCity.findFirst({
      where: {
        ...(excludeId
          ? {
              id: {
                not: excludeId,
              },
            }
          : {}),
        state,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'JÃ¡ existe uma cidade cadastrada com esse nome e UF',
      );
    }
  }

  private async ensurePhotographerUnique(
    cityId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.cityPhotographer.findFirst({
      where: {
        cityId,
        ...(excludeId
          ? {
              id: {
                not: excludeId,
              },
            }
          : {}),
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'JÃ¡ existe um fotÃ³grafo com esse nome nesta cidade',
      );
    }
  }
}
