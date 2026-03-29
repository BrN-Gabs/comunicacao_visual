import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { fileUrlToAbsolutePath } from '../common/upload/file-path.utils';
import { existsSync } from 'fs';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { getCommunicationFrameTemplate } from './communication-frame-template';

type CurrentUser = {
  id: string;
  role: 'ADMIN' | 'VIP' | 'NORMAL';
};

type ExportableFrame = {
  id: string;
  name: string;
  widthM: number | string;
  heightM: number | string;
  cityImageZoom: number;
  cityImageOffsetX: number;
  cityImageOffsetY: number;
  gazinImageZoom: number;
  gazinImageOffsetX: number;
  gazinImageOffsetY: number;
  wall: {
    id: string;
    name: string;
    communication: {
      id: string;
      fullName: string;
      createdById: string;
    };
  };
  projectCityImage: {
    id: string;
    imageUrl: string;
    fileName: string | null;
    authorName: string;
    creditText: string;
  } | null;
  projectGazinImage: {
    id: string;
    gazinLibraryImage: {
      id: string;
      title: string;
      description: string;
      imageUrl: string;
    };
  } | null;
};

type ExportableReadyFrame = Omit<
  ExportableFrame,
  'projectCityImage' | 'projectGazinImage'
> & {
  projectCityImage: NonNullable<ExportableFrame['projectCityImage']>;
  projectGazinImage: NonNullable<ExportableFrame['projectGazinImage']>;
};

type ExportableCommunication = {
  id: string;
  fullName: string;
  createdById: string;
  walls: Array<{
    id: string;
    name: string;
    order: number;
    frames: ExportableFrame[];
  }>;
};

@Injectable()
export class ExportsService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  async exportFrameJpg(frameId: string, user: CurrentUser) {
    const frame = await this.getFrameForExport(frameId, user);
    const jpgBuffer = await this.renderFrameJpgBuffer(frame);

    await this.auditLogsService.create({
      userId: user.id,
      module: 'EXPORTS',
      action: 'EXPORT_FRAME_JPG',
      entityType: 'FRAME',
      entityId: frame.id,
      entityLabel: `${frame.wall.communication.fullName} / ${frame.wall.name} / ${frame.name}`,
      description: 'Quadro exportado em JPG',
      metadata: {
        communicationId: frame.wall.communication.id,
        communicationLabel: frame.wall.communication.fullName,
        wallName: frame.wall.name,
        frameName: frame.name,
      },
    });

    return {
      fileName: this.buildFrameFileName(frame, 'jpg'),
      mimeType: 'image/jpeg',
      buffer: jpgBuffer,
    };
  }

  async exportFramePdf(frameId: string, user: CurrentUser) {
    const frame = await this.getFrameForExport(frameId, user);
    const pdfBuffer = await this.renderFramePdfBuffer(frame);

    await this.auditLogsService.create({
      userId: user.id,
      module: 'EXPORTS',
      action: 'EXPORT_FRAME_PDF',
      entityType: 'FRAME',
      entityId: frame.id,
      entityLabel: `${frame.wall.communication.fullName} / ${frame.wall.name} / ${frame.name}`,
      description: 'Quadro exportado em PDF',
      metadata: {
        communicationId: frame.wall.communication.id,
        communicationLabel: frame.wall.communication.fullName,
        wallName: frame.wall.name,
        frameName: frame.name,
      },
    });

    return {
      fileName: this.buildFrameFileName(frame, 'pdf'),
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    };
  }

  async exportCommunicationJpgZip(communicationId: string, user: CurrentUser) {
    const communication = await this.getCommunicationForExport(
      communicationId,
      user,
    );
    const frames = this.flattenFrames(communication);

    if (frames.length === 0) {
      throw new BadRequestException(
        'A comunicação não possui quadros para exportação',
      );
    }

    const zip = new JSZip();

    for (const wall of communication.walls) {
      const readyFrames = wall.frames.filter(
        (frame): frame is ExportableReadyFrame => this.isReadyFrame(frame),
      );

      for (const frame of readyFrames) {
        const jpgBuffer = await this.renderFrameJpgBuffer(frame);
        zip.file(
          this.buildCommunicationZipPath(wall.order, frame, 'jpg'),
          jpgBuffer,
        );
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'EXPORTS',
      action: 'EXPORT_COMMUNICATION_JPG_ZIP',
      entityType: 'COMMUNICATION',
      entityId: communication.id,
      entityLabel: communication.fullName,
      description: 'Comunicação exportada em ZIP com JPGs',
      metadata: {
        totalFrames: frames.length,
      },
    });

    return {
      fileName: `${this.slugify(communication.fullName)}-quadros.zip`,
      mimeType: 'application/zip',
      buffer: zipBuffer,
    };
  }

  async exportCommunicationPdf(communicationId: string, user: CurrentUser) {
    const communication = await this.getCommunicationForExport(
      communicationId,
      user,
    );
    const frames = this.flattenFrames(communication);

    if (frames.length === 0) {
      throw new BadRequestException(
        'A comunicação não possui quadros para exportação',
      );
    }

    const pdfDoc = await PDFDocument.create();

    for (const frame of frames) {
      const jpgBuffer = await this.renderFrameJpgBuffer(frame);
      const jpgImage = await pdfDoc.embedJpg(jpgBuffer);

      const pageWidth = Math.round(Number(frame.widthM) * 1000);
      const pageHeight = Math.round(Number(frame.heightM) * 1000);

      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      page.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    }

    const pdfBytes = await pdfDoc.save();

    await this.auditLogsService.create({
      userId: user.id,
      module: 'EXPORTS',
      action: 'EXPORT_COMMUNICATION_PDF',
      entityType: 'COMMUNICATION',
      entityId: communication.id,
      entityLabel: communication.fullName,
      description: 'Comunicação exportada em PDF multipágina',
      metadata: {
        totalFrames: frames.length,
      },
    });

    return {
      fileName: `${this.slugify(communication.fullName)}-quadros.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from(pdfBytes),
    };
  }

  async exportCommunicationPdfZip(communicationId: string, user: CurrentUser) {
    const communication = await this.getCommunicationForExport(
      communicationId,
      user,
    );
    const frames = this.flattenFrames(communication);

    if (frames.length === 0) {
      throw new BadRequestException(
        'A comunicaÃ§Ã£o nÃ£o possui quadros para exportaÃ§Ã£o',
      );
    }

    const zip = new JSZip();

    for (const wall of communication.walls) {
      const readyFrames = wall.frames.filter(
        (frame): frame is ExportableReadyFrame => this.isReadyFrame(frame),
      );

      for (const frame of readyFrames) {
        const pdfBuffer = await this.renderFramePdfBuffer(frame);
        zip.file(
          this.buildCommunicationZipPath(wall.order, frame, 'pdf'),
          pdfBuffer,
        );
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    await this.auditLogsService.create({
      userId: user.id,
      module: 'EXPORTS',
      action: 'EXPORT_COMMUNICATION_PDF_ZIP',
      entityType: 'COMMUNICATION',
      entityId: communication.id,
      entityLabel: communication.fullName,
      description: 'ComunicaÃ§Ã£o exportada em ZIP com PDFs',
      metadata: {
        totalFrames: frames.length,
      },
    });

    return {
      fileName: `${this.slugify(communication.fullName)}-quadros-pdf.zip`,
      mimeType: 'application/zip',
      buffer: zipBuffer,
    };
  }

  private async getFrameForExport(
    frameId: string,
    user: CurrentUser,
  ): Promise<ExportableReadyFrame> {
    const frame = (await this.prisma.frame.findUnique({
      where: { id: frameId },
      select: {
        id: true,
        name: true,
        widthM: true,
        heightM: true,
        cityImageZoom: true,
        cityImageOffsetX: true,
        cityImageOffsetY: true,
        gazinImageZoom: true,
        gazinImageOffsetX: true,
        gazinImageOffsetY: true,
        wall: {
          select: {
            id: true,
            name: true,
            communication: {
              select: {
                id: true,
                fullName: true,
                createdById: true,
              },
            },
          },
        },
        projectCityImage: {
          select: {
            id: true,
            imageUrl: true,
            fileName: true,
            authorName: true,
            creditText: true,
          },
        },
        projectGazinImage: {
          select: {
            id: true,
            gazinLibraryImage: {
              select: {
                id: true,
                title: true,
                description: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    })) as ExportableFrame | null;

    if (!frame) {
      throw new NotFoundException('Quadro não encontrado');
    }

    const communication = frame.wall.communication;
    const isOwner = communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new BadRequestException(
        'Você não tem permissão para exportar este quadro',
      );
    }

    if (!frame.projectCityImage || !frame.projectGazinImage) {
      throw new BadRequestException(
        'O quadro precisa ter imagem da cidade e imagem da Gazin alocadas para exportação',
      );
    }

    return frame as ExportableReadyFrame;
  }

  private async getCommunicationForExport(
    communicationId: string,
    user: CurrentUser,
  ): Promise<ExportableCommunication> {
    const communication = (await this.prisma.communication.findUnique({
      where: { id: communicationId },
      select: {
        id: true,
        fullName: true,
        createdById: true,
        walls: {
          orderBy: {
            order: 'asc',
          },
          select: {
            id: true,
            name: true,
            order: true,
            frames: {
              orderBy: {
                order: 'asc',
              },
              select: {
                id: true,
                name: true,
                widthM: true,
                heightM: true,
                cityImageZoom: true,
                cityImageOffsetX: true,
                cityImageOffsetY: true,
                gazinImageZoom: true,
                gazinImageOffsetX: true,
                gazinImageOffsetY: true,
                wall: {
                  select: {
                    id: true,
                    name: true,
                    communication: {
                      select: {
                        id: true,
                        fullName: true,
                        createdById: true,
                      },
                    },
                  },
                },
                projectCityImage: {
                  select: {
                    id: true,
                    imageUrl: true,
                    fileName: true,
                    authorName: true,
                    creditText: true,
                  },
                },
                projectGazinImage: {
                  select: {
                    id: true,
                    gazinLibraryImage: {
                      select: {
                        id: true,
                        title: true,
                        description: true,
                        imageUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })) as ExportableCommunication | null;

    if (!communication) {
      throw new NotFoundException('Comunicação não encontrada');
    }

    const isOwner = communication.createdById === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new BadRequestException(
        'Você não tem permissão para exportar esta comunicação',
      );
    }

    return communication;
  }

  private flattenFrames(communication: ExportableCommunication) {
    return communication.walls.flatMap((wall) =>
      wall.frames.filter((frame): frame is ExportableReadyFrame =>
        this.isReadyFrame(frame),
      ),
    );
  }

  private isReadyFrame(frame: ExportableFrame): frame is ExportableReadyFrame {
    return Boolean(frame.projectCityImage && frame.projectGazinImage);
  }

  private async renderFrameJpgBuffer(frame: ExportableReadyFrame) {
    const communicationFrameTemplate = getCommunicationFrameTemplate();
    const numericWidth = Number(frame.widthM);
    const numericHeight = Number(frame.heightM);
    const widthPx = Math.round(numericWidth * 1200);
    const heightPx = Math.round(numericHeight * 1200);

    const maxWidth = 4400;
    const maxHeight = 2200;
    const minWidth = 1800;
    const minHeight = 900;

    const widthScale = widthPx > maxWidth ? maxWidth / widthPx : 1;
    const heightScale = heightPx > maxHeight ? maxHeight / heightPx : 1;
    const exportScale = Math.min(widthScale, heightScale);

    const safeWidth = Math.max(Math.round(widthPx * exportScale), minWidth);
    const safeHeight = Math.max(Math.round(heightPx * exportScale), minHeight);

    const cityImagePath = fileUrlToAbsolutePath(
      frame.projectCityImage.imageUrl,
    );
    const gazinImagePath = fileUrlToAbsolutePath(
      frame.projectGazinImage.gazinLibraryImage.imageUrl,
    );

    if (!existsSync(cityImagePath)) {
      throw new NotFoundException('Arquivo da imagem da cidade não encontrado');
    }

    if (!existsSync(gazinImagePath)) {
      throw new NotFoundException('Arquivo da imagem da Gazin não encontrado');
    }

    const { cityBounds, gazinBounds, cityLabel, gazinLabel, viewBox } =
      communicationFrameTemplate;
    const scaleX = safeWidth / viewBox.width;
    const scaleY = safeHeight / viewBox.height;
    const scaledCityBounds = {
      x: cityBounds.x * scaleX,
      y: cityBounds.y * scaleY,
      width: cityBounds.width * scaleX,
      height: cityBounds.height * scaleY,
      bleedX: cityBounds.bleedX * scaleX,
      bleedY: cityBounds.bleedY * scaleY,
    };
    const scaledGazinBounds = {
      x: gazinBounds.x * scaleX,
      y: gazinBounds.y * scaleY,
      width: gazinBounds.width * scaleX,
      height: gazinBounds.height * scaleY,
      bleedX: gazinBounds.bleedX * scaleX,
      bleedY: gazinBounds.bleedY * scaleY,
    };
    const scaledCityLabel = {
      x: cityLabel.x * scaleX,
      y: cityLabel.y * scaleY,
      width: cityLabel.width * scaleX,
      height: cityLabel.height * scaleY,
      paddingX: cityLabel.paddingX * scaleX,
      fontSize: cityLabel.fontSize * scaleY,
      angle: this.calculateScaledAngle(cityLabel.line, scaleX, scaleY),
    };
    const scaledGazinLabel = {
      x: gazinLabel.x * scaleX,
      y: gazinLabel.y * scaleY,
      width: gazinLabel.width * scaleX,
      height: gazinLabel.height * scaleY,
      paddingX: gazinLabel.paddingX * scaleX,
      fontSize: gazinLabel.fontSize * scaleY,
      angle: this.calculateScaledAngle(gazinLabel.line, scaleX, scaleY),
    };
    const tagTextMax = 84;
    const leftTagText = this.truncateText(
      `FOTO DE AUTORIA DE: ${frame.projectCityImage.authorName.toUpperCase()}`,
      tagTextMax,
    );
    const rightTagText = this.truncateText(
      (
        frame.projectGazinImage.gazinLibraryImage.description ||
        frame.projectGazinImage.gazinLibraryImage.title
      ).toUpperCase(),
      tagTextMax,
    );
    const cityLabelLayout = this.buildReversedLabelLayout(
      scaledCityLabel,
      leftTagText,
    );
    const gazinLabelLayout = this.buildReversedLabelLayout(
      scaledGazinLabel,
      rightTagText,
    );
    const cityImagePlacement = this.buildImagePlacement(scaledCityBounds, {
      zoom: frame.cityImageZoom,
      offsetX: frame.cityImageOffsetX,
      offsetY: frame.cityImageOffsetY,
    });
    const gazinImagePlacement = this.buildImagePlacement(scaledGazinBounds, {
      zoom: frame.gazinImageZoom,
      offsetX: frame.gazinImageOffsetX,
      offsetY: frame.gazinImageOffsetY,
    });

    const cityImageDataUri = await this.buildImageDataUri(
      cityImagePath,
      Math.max(Math.round(cityImagePlacement.width), 1800),
      Math.max(Math.round(cityImagePlacement.height), 1000),
    );
    const gazinImageDataUri = await this.buildImageDataUri(
      gazinImagePath,
      Math.max(Math.round(gazinImagePlacement.width), 1800),
      Math.max(Math.round(gazinImagePlacement.height), 1000),
    );

    const svg = `
      <svg width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="panel-shadow" x="-8%" y="-10%" width="116%" height="124%">
            <feDropShadow dx="0" dy="${Math.round(56 * scaleY)}" stdDeviation="${Math.round(48 * Math.min(scaleX, scaleY))}" flood-color="#15435b" flood-opacity="0.18" />
          </filter>
          <clipPath id="city-image-clip" clipPathUnits="userSpaceOnUse">
            <path d="${communicationFrameTemplate.cityPath}" transform="scale(${scaleX} ${scaleY})" />
          </clipPath>
          <clipPath id="gazin-image-clip" clipPathUnits="userSpaceOnUse">
            <path d="${communicationFrameTemplate.gazinPath}" transform="scale(${scaleX} ${scaleY})" />
          </clipPath>
        </defs>

        <rect width="${safeWidth}" height="${safeHeight}" fill="${communicationFrameTemplate.backgroundColor}" />

        <g clip-path="url(#city-image-clip)">
          <rect
            x="${scaledCityBounds.x}"
            y="${scaledCityBounds.y}"
            width="${scaledCityBounds.width}"
            height="${scaledCityBounds.height}"
            fill="${communicationFrameTemplate.placeholderColor}"
          />
          <image
            href="${cityImageDataUri}"
            x="${cityImagePlacement.x}"
            y="${cityImagePlacement.y}"
            width="${cityImagePlacement.width}"
            height="${cityImagePlacement.height}"
            preserveAspectRatio="xMidYMid slice"
          />
        </g>

        <g clip-path="url(#gazin-image-clip)">
          <rect
            x="${scaledGazinBounds.x}"
            y="${scaledGazinBounds.y}"
            width="${scaledGazinBounds.width}"
            height="${scaledGazinBounds.height}"
            fill="${communicationFrameTemplate.placeholderColor}"
          />
          <image
            href="${gazinImageDataUri}"
            x="${gazinImagePlacement.x}"
            y="${gazinImagePlacement.y}"
            width="${gazinImagePlacement.width}"
            height="${gazinImagePlacement.height}"
            preserveAspectRatio="xMidYMid slice"
          />
        </g>

        <g filter="url(#panel-shadow)">
          <path
            d="${communicationFrameTemplate.borderPath}"
            transform="scale(${scaleX} ${scaleY})"
            fill="#ffffff"
            stroke="#ffffff"
            stroke-width="${Math.max(6 * Math.min(scaleX, scaleY), 3)}"
            stroke-linejoin="round"
          />
        </g>

        <g transform="translate(${cityLabelLayout.x} ${cityLabelLayout.y}) rotate(${cityLabelLayout.angle})">
          <rect x="0" y="0" width="${cityLabelLayout.width}" height="${cityLabelLayout.height}" fill="${communicationFrameTemplate.labelColor}" />
          <text
            x="${cityLabelLayout.width / 2}"
            y="${cityLabelLayout.height / 2 + cityLabelLayout.fontSize / 3}"
            font-size="${cityLabelLayout.fontSize}"
            font-family="${communicationFrameTemplate.labelFontFamily}"
            font-weight="${communicationFrameTemplate.labelFontWeight}"
            fill="#ffffff"
            text-anchor="middle"
          >${this.escapeXml(leftTagText)}</text>
        </g>

        <g transform="translate(${gazinLabelLayout.x} ${gazinLabelLayout.y}) rotate(${gazinLabelLayout.angle})">
          <rect x="0" y="0" width="${gazinLabelLayout.width}" height="${gazinLabelLayout.height}" fill="${communicationFrameTemplate.labelColor}" />
          <text
            x="${gazinLabelLayout.width / 2}"
            y="${gazinLabelLayout.height / 2 + gazinLabelLayout.fontSize / 3}"
            font-size="${gazinLabelLayout.fontSize}"
            font-family="${communicationFrameTemplate.labelFontFamily}"
            font-weight="${communicationFrameTemplate.labelFontWeight}"
            fill="#ffffff"
            text-anchor="middle"
          >${this.escapeXml(rightTagText)}</text>
        </g>
      </svg>
    `;

    return sharp(Buffer.from(svg), {
      density: 240,
    })
      .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
      .toBuffer();
  }

  private async renderFramePdfBuffer(frame: ExportableReadyFrame) {
    const jpgBuffer = await this.renderFrameJpgBuffer(frame);

    const pdfDoc = await PDFDocument.create();
    const jpgImage = await pdfDoc.embedJpg(jpgBuffer);

    const pageWidth = Math.round(Number(frame.widthM) * 1000);
    const pageHeight = Math.round(Number(frame.heightM) * 1000);

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private buildFrameFileName(
    frame: Pick<ExportableFrame, 'name' | 'widthM' | 'heightM'>,
    extension: 'jpg' | 'pdf',
  ) {
    const frameName = this.sanitizeFileName(frame.name) || 'Quadro';
    const dimensions = `${this.formatMeasure(frame.heightM)}x${this.formatMeasure(frame.widthM)}m`;

    return `${frameName} - AxL ${dimensions}.${extension}`;
  }

  private buildCommunicationZipPath(
    wallOrder: number,
    frame: Pick<ExportableFrame, 'name' | 'widthM' | 'heightM'>,
    extension: 'jpg' | 'pdf',
  ) {
    const wallFolder = `Parede ${String(Math.max(1, Math.trunc(Number(wallOrder) || 1))).padStart(2, '0')}`;
    return `${wallFolder}/${this.buildFrameFileName(frame, extension)}`;
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private escapeXml(value: string) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  private formatMeasure(value: string | number) {
    const parsed = Number(value);

    if (Number.isNaN(parsed)) {
      return '0,00';
    }

    return parsed.toFixed(2).replace('.', ',');
  }

  private sanitizeFileName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private truncateText(value: string, maxChars: number) {
    const normalized = String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized.length <= maxChars) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(maxChars - 1, 1)).trimEnd()}…`;
  }

  private calculateScaledAngle(
    line: { x1: number; y1: number; x2: number; y2: number },
    scaleX: number,
    scaleY: number,
  ) {
    return (
      (Math.atan2((line.y2 - line.y1) * scaleY, (line.x2 - line.x1) * scaleX) *
        180) /
      Math.PI
    );
  }

  private buildReversedLabelLayout(
    label: {
      x: number;
      y: number;
      width: number;
      height: number;
      paddingX: number;
      fontSize: number;
      angle: number;
    },
    text: string,
  ) {
    const contentWidth =
      this.estimateLabelTextWidth(text, label.fontSize) +
      label.paddingX * 2 +
      label.fontSize * 0.18;
    const width = Math.max(contentWidth, label.height * 2.35);
    const radians = (label.angle * Math.PI) / 180;

    return {
      ...label,
      x: label.x + Math.cos(radians) * width - Math.sin(radians) * label.height,
      y: label.y + Math.sin(radians) * width + Math.cos(radians) * label.height,
      width,
      angle: label.angle - 180,
    };
  }

  private buildImagePlacement(
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
      bleedX: number;
      bleedY: number;
    },
    transform: {
      zoom: number;
      offsetX: number;
      offsetY: number;
    },
  ) {
    const zoom = this.clamp(Number(transform.zoom) || 1, 1, 3);
    const offsetX = this.clamp(Number(transform.offsetX) || 0, -100, 100);
    const offsetY = this.clamp(Number(transform.offsetY) || 0, -100, 100);
    const baseWidth = bounds.width + bounds.bleedX * 2;
    const baseHeight = bounds.height + bounds.bleedY * 2;
    const width = baseWidth * zoom;
    const height = baseHeight * zoom;
    const availableShiftX = Math.max((width - bounds.width) / 2, 0);
    const availableShiftY = Math.max((height - bounds.height) / 2, 0);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    return {
      x: centerX - width / 2 + availableShiftX * (offsetX / 100),
      y: centerY - height / 2 + availableShiftY * (offsetY / 100),
      width,
      height,
    };
  }

  private estimateLabelTextWidth(text: string, fontSize: number) {
    return text.length * fontSize * 0.66;
  }

  private wrapText(value: string, maxCharsPerLine: number, maxLines: number) {
    const normalized = String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return [''];
    }

    const words = normalized.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    let wordIndex = 0;

    for (; wordIndex < words.length; wordIndex += 1) {
      const word = words[wordIndex];
      const candidate = currentLine ? `${currentLine} ${word}` : word;

      if (candidate.length <= maxCharsPerLine || !currentLine) {
        currentLine = candidate;
        continue;
      }

      lines.push(currentLine);
      currentLine = word;

      if (lines.length === maxLines - 1) {
        wordIndex += 1;
        break;
      }
    }

    if (currentLine && lines.length < maxLines) {
      lines.push(currentLine);
    }

    if (wordIndex < words.length && lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      lines[lines.length - 1] = `${lastLine.slice(
        0,
        Math.max(maxCharsPerLine - 1, 1),
      )}…`;
    }

    return lines.slice(0, maxLines);
  }

  private buildSvgTspans(
    lines: string[],
    x: number,
    startY: number,
    lineHeight: number,
    fontSize: number,
  ) {
    return lines
      .map(
        (line, index) =>
          `<tspan x="${x}" y="${startY + index * lineHeight}" font-size="${fontSize}">${this.escapeXml(line)}</tspan>`,
      )
      .join('');
  }

  private async buildImageDataUri(
    filePath: string,
    width: number,
    height: number,
  ) {
    const buffer = await sharp(filePath)
      .rotate()
      .resize({
        width,
        height,
        fit: 'cover',
        position: 'centre',
      })
      .jpeg({ quality: 92 })
      .toBuffer();

    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  }
}
