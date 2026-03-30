export const MAX_IMAGE_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_SIZE_LABEL = "15 MB";
export const MAX_BATCH_IMAGE_UPLOAD_SIZE_BYTES = 200 * 1024 * 1024;
export const MAX_BATCH_IMAGE_UPLOAD_SIZE_LABEL = "200 MB";
export const IMAGE_UPLOAD_REQUEST_TIMEOUT_MS = 180_000;

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function getImageUploadSizeError(files: Iterable<File>) {
  const oversizedFiles = Array.from(files).filter(
    (file) => file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES,
  );

  if (!oversizedFiles.length) {
    return "";
  }

  if (oversizedFiles.length === 1) {
    const [file] = oversizedFiles;

    return `O arquivo "${file.name}" tem ${formatFileSize(file.size)} e excede o limite de ${MAX_IMAGE_UPLOAD_SIZE_LABEL}.`;
  }

  return `${oversizedFiles.length} arquivo(s) excedem o limite de ${MAX_IMAGE_UPLOAD_SIZE_LABEL}.`;
}

export function getBatchImageUploadSizeError(files: Iterable<File>) {
  const fileList = Array.from(files);
  const totalSize = fileList.reduce((sum, file) => sum + file.size, 0);

  if (totalSize <= MAX_BATCH_IMAGE_UPLOAD_SIZE_BYTES) {
    return "";
  }

  return `A seleção totalizou ${formatFileSize(totalSize)}. Envie até ${MAX_BATCH_IMAGE_UPLOAD_SIZE_LABEL} por vez.`;
}
