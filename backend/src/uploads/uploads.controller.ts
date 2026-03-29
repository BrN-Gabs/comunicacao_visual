import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { diskStorage } from 'multer';
import { mkdirSync, existsSync } from 'fs';
import { extname, join } from 'path';
import { UploadsService } from './uploads.service';

function ensureFolderExists(folderPath: string) {
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }
}

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('single')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const folder = (req.query.folder as string) || 'general';
          const uploadPath = join(process.cwd(), 'uploads', folder);
          ensureFolderExists(uploadPath);
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: {
        fileSize: 15 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(
            new BadRequestException('Apenas imagens são permitidas'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder = 'general',
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    return {
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: this.uploadsService.buildFileUrl(folder, file.filename),
    };
  }

  @Post('multiple')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const folder = (req.query.folder as string) || 'general';
          const uploadPath = join(process.cwd(), 'uploads', folder);
          ensureFolderExists(uploadPath);
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: {
        fileSize: 15 * 1024 * 1024,
        files: 20,
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(
            new BadRequestException('Apenas imagens são permitidas'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('folder') folder = 'general',
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    return {
      total: files.length,
      files: files.map((file) => ({
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: this.uploadsService.buildFileUrl(folder, file.filename),
      })),
    };
  }
}
