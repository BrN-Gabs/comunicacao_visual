import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UserRole } from './dto/create-user.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(data: CreateUserDto, performedByUserId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new BadRequestException('Email já cadastrado');
    }

    const passwordHash = await hash(data.password, 10);

    const created = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role ?? 'NORMAL',
      },
      select: this.userSelect(),
    });

    await this.auditLogsService.create({
      userId: performedByUserId ?? null,
      module: 'USERS',
      action: 'CREATE',
      entityType: 'USER',
      entityId: created.id,
      entityLabel: created.name,
      description: 'Usuário criado',
      metadata: {
        email: created.email,
        role: created.role,
        status: created.status,
      },
    });

    return created;
  }

  async findAll(filters: FilterUsersDto) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 10;
    const skip = (page - 1) * limit;

    const where = {
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                name: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                email: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: this.userSelect(),
      }),
      this.prisma.user.count({ where }),
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

  async update(
    userId: string,
    data: UpdateUserDto,
    performedByUserId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    if (!user) {
      throw new NotFoundException('UsuÃ¡rio nÃ£o encontrado');
    }

    if (data.email && data.email !== user.email) {
      const emailOwner = await this.prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true },
      });

      if (emailOwner && emailOwner.id !== user.id) {
        throw new BadRequestException('Email jÃ¡ cadastrado');
      }
    }

    if (user.role === 'ADMIN' && data.role && data.role !== UserRole.ADMIN) {
      const activeAdmins = await this.prisma.user.count({
        where: {
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      if (activeAdmins <= 1 && user.status === 'ACTIVE') {
        throw new BadRequestException(
          'NÃ£o Ã© possÃ­vel remover o Ãºltimo Admin ativo',
        );
      }
    }

    const updateData: {
      name?: string;
      email?: string;
      role?: 'ADMIN' | 'VIP' | 'NORMAL';
      passwordHash?: string;
    } = {};

    if (typeof data.name === 'string') {
      updateData.name = data.name;
    }

    if (typeof data.email === 'string') {
      updateData.email = data.email;
    }

    if (typeof data.role === 'string') {
      updateData.role = data.role;
    }

    if (typeof data.password === 'string' && data.password.length > 0) {
      updateData.passwordHash = await hash(data.password, 10);
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Nenhum dado informado para atualizaÃ§Ã£o');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: this.userSelect(),
    });

    await this.auditLogsService.create({
      userId: performedByUserId ?? null,
      module: 'USERS',
      action: 'UPDATE',
      entityType: 'USER',
      entityId: updated.id,
      entityLabel: updated.name,
      description: 'UsuÃ¡rio atualizado',
      metadata: {
        oldName: user.name,
        newName: updated.name,
        oldEmail: user.email,
        newEmail: updated.email,
        oldRole: user.role,
        newRole: updated.role,
        passwordChanged: Boolean(updateData.passwordHash),
      },
    });

    return updated;
  }

  async updateStatus(
    userId: string,
    status: 'ACTIVE' | 'INACTIVE',
    performedByUserId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (user.role === 'ADMIN' && status === 'INACTIVE') {
      const activeAdmins = await this.prisma.user.count({
        where: {
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      if (activeAdmins <= 1 && user.status === 'ACTIVE') {
        throw new BadRequestException(
          'Não é possível inativar o último Admin ativo',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: this.userSelect(),
    });

    await this.auditLogsService.create({
      userId: performedByUserId ?? null,
      module: 'USERS',
      action: 'UPDATE_STATUS',
      entityType: 'USER',
      entityId: updated.id,
      entityLabel: updated.name,
      description: 'Status do usuário atualizado',
      metadata: {
        email: updated.email,
        oldStatus: user.status,
        newStatus: updated.status,
      },
    });

    return updated;
  }

  async updateRole(
    userId: string,
    role: 'ADMIN' | 'VIP' | 'NORMAL',
    performedByUserId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (user.role === 'ADMIN' && role !== 'ADMIN') {
      const activeAdmins = await this.prisma.user.count({
        where: {
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      if (activeAdmins <= 1 && user.status === 'ACTIVE') {
        throw new BadRequestException(
          'Não é possível remover o último Admin ativo',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: this.userSelect(),
    });

    await this.auditLogsService.create({
      userId: performedByUserId ?? null,
      module: 'USERS',
      action: 'UPDATE_ROLE',
      entityType: 'USER',
      entityId: updated.id,
      entityLabel: updated.name,
      description: 'Perfil do usuário atualizado',
      metadata: {
        email: updated.email,
        oldRole: user.role,
        newRole: updated.role,
      },
    });

    return updated;
  }

  async remove(userId: string, performedByUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    if (!user) {
      throw new NotFoundException('UsuÃ¡rio nÃ£o encontrado');
    }

    if (performedByUserId && performedByUserId === userId) {
      throw new BadRequestException(
        'NÃ£o Ã© possÃ­vel excluir a sua prÃ³pria conta',
      );
    }

    if (user.role === 'ADMIN' && user.status === 'ACTIVE') {
      const activeAdmins = await this.prisma.user.count({
        where: {
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      if (activeAdmins <= 1) {
        throw new BadRequestException(
          'NÃ£o Ã© possÃ­vel excluir o Ãºltimo Admin ativo',
        );
      }
    }

    const [
      createdCommunicationsCount,
      createdGazinImagesCount,
      statusHistoryCount,
    ] = await Promise.all([
      this.prisma.communication.count({
        where: {
          createdById: userId,
        },
      }),
      this.prisma.gazinLibraryImage.count({
        where: {
          createdById: userId,
        },
      }),
      this.prisma.communicationStatusHistory.count({
        where: {
          changedById: userId,
        },
      }),
    ]);

    if (
      createdCommunicationsCount > 0 ||
      createdGazinImagesCount > 0 ||
      statusHistoryCount > 0
    ) {
      throw new BadRequestException(
        'NÃ£o Ã© possÃ­vel excluir um usuÃ¡rio que possui imagens, comunicaÃ§Ãµes ou histÃ³rico vinculados',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.updateMany({
        where: { userId },
        data: { userId: null },
      });

      await tx.communication.updateMany({
        where: { validatedById: userId },
        data: { validatedById: null },
      });

      await tx.user.delete({
        where: { id: userId },
      });
    });

    await this.auditLogsService.create({
      userId: performedByUserId ?? null,
      module: 'USERS',
      action: 'DELETE',
      entityType: 'USER',
      entityId: user.id,
      entityLabel: user.name,
      description: 'UsuÃ¡rio removido',
      metadata: {
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });

    return {
      message: 'UsuÃ¡rio removido com sucesso',
    };
  }

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.userSelect(),
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  private userSelect() {
    return {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
