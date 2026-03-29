import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export function ensureFolderExists(folderPath: string) {
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }
}

export function imageFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  const extension = extname(file.originalname).toLowerCase();

  if (!file.mimetype.startsWith('image/')) {
    return cb(new BadRequestException('Apenas imagens são permitidas'), false);
  }

  if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
    return cb(
      new BadRequestException(
        `Extensão não permitida. Use: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}`,
      ),
      false,
    );
  }

  cb(null, true);
}

export function buildUploadPath(...segments: string[]) {
  return join(process.cwd(), 'uploads', ...segments);
}

export function generateUploadFileName(originalName: string) {
  const extension = extname(originalName).toLowerCase();
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
}
