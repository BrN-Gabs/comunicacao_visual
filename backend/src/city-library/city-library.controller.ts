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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  buildUploadPath,
  ensureFolderExists,
  generateUploadFileName,
  imageFileFilter,
} from '../common/upload/upload.utils';
import { CityLibraryService } from './city-library.service';
import { FilterCityLibraryCitiesDto } from './dto/filter-city-library-cities.dto';
import { CreateCityLibraryCityDto } from './dto/create-city-library-city.dto';
import { UpdateCityLibraryCityDto } from './dto/update-city-library-city.dto';
import { CreateCityPhotographerDto } from './dto/create-city-photographer.dto';
import { UpdateCityPhotographerDto } from './dto/update-city-photographer.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'VIP')
@Controller('city-library')
export class CityLibraryController {
  constructor(private readonly cityLibraryService: CityLibraryService) {}

  @Get('cities')
  findAllCities(@Query() query: FilterCityLibraryCitiesDto) {
    return this.cityLibraryService.findAllCities(query);
  }

  @Get('cities/:id')
  findCity(@Param('id') id: string) {
    return this.cityLibraryService.findCity(id);
  }

  @Post('cities')
  createCity(
    @CurrentUser() user: { id: string },
    @Body() data: CreateCityLibraryCityDto,
  ) {
    return this.cityLibraryService.createCity(user.id, data);
  }

  @Patch('cities/:id')
  updateCity(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() data: UpdateCityLibraryCityDto,
  ) {
    return this.cityLibraryService.updateCity(id, user.id, data);
  }

  @Delete('cities/:id')
  removeCity(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.cityLibraryService.removeCity(id, user.id);
  }

  @Post('cities/:id/photographers')
  createPhotographer(
    @Param('id') cityId: string,
    @CurrentUser() user: { id: string },
    @Body() data: CreateCityPhotographerDto,
  ) {
    return this.cityLibraryService.createPhotographer(cityId, user.id, data);
  }

  @Patch('photographers/:id')
  updatePhotographer(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() data: UpdateCityPhotographerDto,
  ) {
    return this.cityLibraryService.updatePhotographer(id, user.id, data);
  }

  @Delete('photographers/:id')
  removePhotographer(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.cityLibraryService.removePhotographer(id, user.id);
  }

  @Post('photographers/:id/images/upload')
  @UseInterceptors(
    FilesInterceptor('files', 50, {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const photographerId = Array.isArray(req.params.id)
            ? req.params.id[0]
            : req.params.id;
          const uploadPath = buildUploadPath('city-library', photographerId);
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
  uploadPhotographerImages(
    @Param('id') photographerId: string,
    @CurrentUser() user: { id: string },
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    return this.cityLibraryService.uploadPhotographerImages(
      photographerId,
      user.id,
      files,
    );
  }

  @Patch('images/:id/reupload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadPath = buildUploadPath('city-library', 'reuploads');
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
  reuploadImage(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    return this.cityLibraryService.reuploadImage(id, user.id, file);
  }

  @Delete('images/:id')
  removeImage(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.cityLibraryService.removeImage(id, user.id);
  }
}
