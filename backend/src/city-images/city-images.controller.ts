import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { CityImagesService } from './city-images.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateCityImagesDto } from './dto/create-city-images.dto';
import { UpdateCityImageDto } from './dto/update-city-image.dto';
import {
  buildUploadPath,
  ensureFolderExists,
  generateUploadFileName,
  imageFileFilter,
} from '../common/upload/upload.utils';

@UseGuards(JwtAuthGuard)
@Controller('communications/:communicationId/city-images')
export class CityImagesController {
  constructor(private readonly service: CityImagesService) {}

  @Post()
  createMany(
    @Param('communicationId') communicationId: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Body() data: CreateCityImagesDto,
  ) {
    return this.service.createMany(communicationId, user, data);
  }

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 50, {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const communicationId = req.params.communicationId;

          if (!communicationId || Array.isArray(communicationId)) {
            return cb(new BadRequestException('communicationId invÃ¡lido'), '');
          }

          const uploadPath = buildUploadPath('city-images', communicationId);
          ensureFolderExists(uploadPath);
          cb(null, uploadPath);
        },
        filename: (_req, file, cb) => {
          cb(null, generateUploadFileName(file.originalname));
        },
      }),
      limits: {
        fileSize: 15 * 1024 * 1024,
        files: 50,
      },
      fileFilter: imageFileFilter,
    }),
  )
  uploadAndCreate(
    @Param('communicationId') communicationId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Query('authorName') authorName: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    if (!authorName) {
      throw new BadRequestException('authorName é obrigatório');
    }

    return this.service.createFromUpload(
      communicationId,
      user,
      files,
      authorName,
    );
  }

  @Get()
  findAll(@Param('communicationId') communicationId: string) {
    return this.service.findAllByCommunication(communicationId);
  }

  @Patch('item/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
    @Body() data: UpdateCityImageDto,
  ) {
    return this.service.update(id, user, data);
  }

  @Delete('item/:id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
  ) {
    return this.service.remove(id, user);
  }

  @Patch('item/:id/reupload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const communicationId = req.params.communicationId;

          if (!communicationId || Array.isArray(communicationId)) {
            return cb(new BadRequestException('communicationId invÃ¡lido'), '');
          }

          const uploadPath = buildUploadPath('city-images', communicationId);
          ensureFolderExists(uploadPath);
          cb(null, uploadPath);
        },
        filename: (_req, file, cb) => {
          cb(null, generateUploadFileName(file.originalname));
        },
      }),
      limits: {
        fileSize: 15 * 1024 * 1024,
      },
      fileFilter: imageFileFilter,
    }),
  )
  reupload(
    @Param('communicationId') communicationId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string; role: 'ADMIN' | 'VIP' | 'NORMAL' },
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    return this.service.reupload(communicationId, id, user, file);
  }
}
