import { join } from 'path';

export function fileUrlToAbsolutePath(fileUrl: string) {
  const normalized = fileUrl.replace(/^\/+/, '');
  return join(process.cwd(), normalized);
}
