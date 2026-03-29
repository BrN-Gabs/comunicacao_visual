import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

export function deletePhysicalFileFromUrl(fileUrl?: string | null) {
  if (!fileUrl) return;

  const normalized = fileUrl.replace(/^\/+/, '');
  const fullPath = join(process.cwd(), normalized);

  if (existsSync(fullPath)) {
    unlinkSync(fullPath);
  }
}
