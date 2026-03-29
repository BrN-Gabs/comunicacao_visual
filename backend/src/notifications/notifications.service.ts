import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type NotificationTone = 'info' | 'success' | 'warning' | 'danger';

type AuditLogNotificationRecord = {
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
    role: 'ADMIN' | 'VIP' | 'NORMAL';
  } | null;
};

const includedModules = [
  'COMMUNICATIONS',
  'FRAMES',
  'CITY_IMAGES',
  'CITY_LIBRARY',
  'GAZIN_LIBRARY',
  'PROJECT_GAZIN_IMAGES',
  'USERS',
  'EXPORTS',
  'DASHBOARD',
] as const;

const suspiciousTextPattern = /(?:Ã.|Â.|â.|�)/;
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
    let decodedValue = '';

    try {
      decodedValue = decodeURIComponent(escape(nextValue));
    } catch {
      break;
    }

    if (!decodedValue || decodedValue === nextValue) {
      break;
    }

    nextValue = decodedValue;
  }

  for (const [brokenValue, fixedValue] of fallbackMojibakeEntries) {
    nextValue = nextValue.split(brokenValue).join(fixedValue);
  }

  return nextValue;
}

function isRecord(
  value: Prisma.JsonValue | null,
): value is Record<string, Prisma.JsonValue> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getMetadataString(
  metadata: Prisma.JsonValue | null,
  key: string,
): string | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const value = metadata[key];

  return typeof value === 'string' && value.trim()
    ? normalizeText(value)
    : null;
}

function getHref(log: AuditLogNotificationRecord) {
  if (log.module === 'COMMUNICATIONS' && log.entityId) {
    return `/communications/${log.entityId}`;
  }

  if (log.module === 'FRAMES' || log.module === 'CITY_IMAGES') {
    const communicationId = getMetadataString(log.metadata, 'communicationId');
    return communicationId
      ? `/communications/${communicationId}`
      : '/communications';
  }

  if (log.module === 'PROJECT_GAZIN_IMAGES') {
    const communicationId = getMetadataString(log.metadata, 'communicationId');
    return communicationId
      ? `/communications/${communicationId}`
      : '/communications';
  }

  if (log.module === 'EXPORTS') {
    const communicationId = getMetadataString(log.metadata, 'communicationId');

    if (communicationId) {
      return `/communications/${communicationId}`;
    }

    if (log.entityType === 'COMMUNICATION' && log.entityId) {
      return `/communications/${log.entityId}`;
    }

    return '/dashboard';
  }

  if (log.module === 'USERS') {
    return '/users';
  }

  if (log.module === 'GAZIN_LIBRARY') {
    return '/gazin-library';
  }

  if (log.module === 'CITY_LIBRARY') {
    return '/city-library';
  }

  if (log.module === 'DASHBOARD') {
    return '/dashboard';
  }

  return '/logs';
}

function getTitle(log: AuditLogNotificationRecord) {
  const key = `${log.module}:${log.action}`;

  switch (key) {
    case 'COMMUNICATIONS:CREATE':
      return 'Nova comunicação criada';
    case 'COMMUNICATIONS:FINALIZE':
      return 'Comunicação finalizada';
    case 'COMMUNICATIONS:VALIDATE':
      return 'Comunicação validada';
    case 'COMMUNICATIONS:DIVERGE':
      return 'Comunicação marcada como divergente';
    case 'COMMUNICATIONS:DELETE':
      return 'Comunicação removida';
    case 'COMMUNICATIONS:ASSIGN_IMAGES':
      return 'Quadros redistribuídos';
    case 'FRAMES:DELETE':
      return 'Quadro removido';
    case 'FRAMES:UPDATE_DIMENSIONS':
      return 'Dimensoes do quadro atualizadas';
    case 'FRAMES:UPDATE_IMAGE_LAYOUT':
      return 'Enquadramento do quadro atualizado';
    case 'FRAMES:SWAP_CITY_IMAGE':
      return 'Imagem da cidade trocada';
    case 'FRAMES:SWAP_GAZIN_IMAGE':
      return 'Imagem da Gazin trocada';
    case 'CITY_IMAGES:CREATE_MANY':
    case 'CITY_IMAGES:UPLOAD_CREATE':
      return 'Imagens da cidade adicionadas';
    case 'CITY_IMAGES:DELETE':
      return 'Imagem da cidade removida';
    case 'CITY_IMAGES:REUPLOAD':
      return 'Imagem da cidade substituída';
    case 'GAZIN_LIBRARY:CREATE':
    case 'GAZIN_LIBRARY:UPLOAD_CREATE':
      return 'Imagem da Gazin cadastrada';
    case 'GAZIN_LIBRARY:DELETE':
      return 'Imagem da Gazin removida';
    case 'GAZIN_LIBRARY:REUPLOAD':
      return 'Imagem da Gazin substituída';
    case 'USERS:CREATE':
      return 'Novo usuário criado';
    case 'USERS:DELETE':
      return 'Usuário removido';
    case 'USERS:UPDATE_ROLE':
      return 'Perfil de usuário alterado';
    case 'USERS:UPDATE_STATUS':
      return 'Status de usuário alterado';
    case 'EXPORTS:EXPORT_FRAME_JPG':
    case 'EXPORTS:EXPORT_FRAME_PDF':
    case 'EXPORTS:EXPORT_COMMUNICATION_PDF':
    case 'EXPORTS:EXPORT_COMMUNICATION_PDF_ZIP':
    case 'EXPORTS:EXPORT_COMMUNICATION_JPG_ZIP':
      return 'Exportação concluída';
    case 'DASHBOARD:CLEAR_RECENT_EXPORTS':
      return 'Exportações recentes limpas';
    default:
      return log.entityLabel || log.description;
  }
}

function getTone(log: AuditLogNotificationRecord): NotificationTone {
  const key = `${log.module}:${log.action}`;

  switch (key) {
    case 'COMMUNICATIONS:VALIDATE':
    case 'EXPORTS:EXPORT_FRAME_JPG':
    case 'EXPORTS:EXPORT_FRAME_PDF':
    case 'EXPORTS:EXPORT_COMMUNICATION_PDF':
    case 'EXPORTS:EXPORT_COMMUNICATION_PDF_ZIP':
    case 'EXPORTS:EXPORT_COMMUNICATION_JPG_ZIP':
      return 'success';
    case 'COMMUNICATIONS:DIVERGE':
    case 'USERS:DELETE':
    case 'COMMUNICATIONS:DELETE':
    case 'FRAMES:DELETE':
    case 'CITY_IMAGES:DELETE':
    case 'GAZIN_LIBRARY:DELETE':
      return 'danger';
    case 'DASHBOARD:CLEAR_RECENT_EXPORTS':
      return 'warning';
    default:
      return 'info';
  }
}

function getDescription(log: AuditLogNotificationRecord) {
  const comment = getMetadataString(log.metadata, 'comment');

  if (log.module === 'COMMUNICATIONS' && log.action === 'DIVERGE' && comment) {
    return `${log.description}. Comentario: ${comment}`;
  }

  return log.description;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecent(limit = 12) {
    const normalizedLimit = Math.min(Math.max(limit, 1), 20);

    const notifications = await this.prisma.auditLog.findMany({
      where: {
        module: {
          in: [...includedModules],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: normalizedLimit,
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

    return {
      notifications: notifications.map((log) => ({
        id: log.id,
        module: log.module,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        entityLabel: log.entityLabel ? normalizeText(log.entityLabel) : null,
        title: normalizeText(getTitle(log)),
        description: normalizeText(getDescription(log)),
        href: getHref(log),
        tone: getTone(log),
        createdAt: log.createdAt,
        user: log.user,
      })),
      meta: {
        limit: normalizedLimit,
        generatedAt: new Date(),
      },
    };
  }
}
