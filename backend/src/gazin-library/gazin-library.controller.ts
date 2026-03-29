import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GazinLibraryService } from './gazin-library.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateGazinLibraryImageDto } from './dto/create-gazin-library-image.dto';
import { UpdateGazinLibraryImageDto } from './dto/update-gazin-library-image.dto';
import { UpdateGazinLibraryImageStatusDto } from './dto/update-gazin-library-image-status.dto';
import { FilterGazinLibraryImagesDto } from './dto/filter-gazin-library-images.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import {
  buildUploadPath,
  ensureFolderExists,
  generateUploadFileName,
  imageFileFilter,
} from '../common/upload/upload.utils';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'VIP')
@Controller('gazin-library')
export class GazinLibraryController {
  constructor(private readonly gazinLibraryService: GazinLibraryService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() data: CreateGazinLibraryImageDto,
  ) {
    return this.gazinLibraryService.create(user.id, data);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadPath = buildUploadPath('gazin-library');
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
  uploadAndCreate(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
    @Query('title') title: string,
    @Query('description') description: string,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    if (!title) {
      throw new BadRequestException('title é obrigatório');
    }

    if (!description) {
      throw new BadRequestException('description é obrigatório');
    }

    return this.gazinLibraryService.createFromUpload(
      user.id,
      file,
      title,
      description,
    );
  }

  @Get()
  findAll(@Query() query: FilterGazinLibraryImagesDto) {
    return this.gazinLibraryService.findAll(query);
  }

  @Get('active-count')
  activeCount() {
    return this.gazinLibraryService.countActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gazinLibraryService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() data: UpdateGazinLibraryImageDto,
  ) {
    return this.gazinLibraryService.update(id, user.id, data);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() data: UpdateGazinLibraryImageStatusDto,
  ) {
    return this.gazinLibraryService.updateStatus(id, user.id, data);
  }

  @Patch(':id/reupload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadPath = buildUploadPath('gazin-library');
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
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string },
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    return this.gazinLibraryService.reupload(id, user.id, file);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.gazinLibraryService.remove(id, user.id);
  }
}
