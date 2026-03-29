import { Injectable } from '@nestjs/common';
import { extname } from 'path';

@Injectable()
export class UploadsService {
  generateFileName(originalName: string) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = extname(originalName);
    const baseName = originalName
      .replace(extension, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return `${baseName || 'file'}-${uniqueSuffix}${extension}`;
  }

  buildFileUrl(folder: string, fileName: string) {
    return `/uploads/${folder}/${fileName}`;
  }
}
