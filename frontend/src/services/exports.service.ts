import type { AxiosProgressEvent } from "axios";
import { api } from "@/lib/api";

export type DownloadProgressInfo = {
  percent: number;
  loadedBytes: number;
  totalBytes: number | null;
};

export type ExportJobInfo = {
  id: string;
  format: "jpg" | "pdf";
  status: "processing" | "completed" | "failed";
  fileName: string;
  communicationId: string;
  communicationLabel: string;
  totalFrames: number;
  completedFrames: number;
  currentFrameName: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type DownloadFileOptions = {
  onProgress?: (info: DownloadProgressInfo) => void;
};

function extractFileName(contentDisposition?: string | null) {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const classicMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return classicMatch?.[1] ?? null;
}

async function downloadFile(
  path: string,
  fallbackFileName: string,
  options: DownloadFileOptions = {},
) {
  options.onProgress?.({
    percent: 0,
    loadedBytes: 0,
    totalBytes: null,
  });

  const response = await api.get<Blob>(path, {
    responseType: "blob",
    onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
      const loadedBytes =
        typeof progressEvent.loaded === "number" ? progressEvent.loaded : 0;
      const totalBytes =
        typeof progressEvent.total === "number" && progressEvent.total > 0
          ? progressEvent.total
          : null;
      const percent =
        typeof progressEvent.progress === "number"
          ? Math.round(progressEvent.progress * 100)
          : totalBytes
            ? Math.round((loadedBytes / totalBytes) * 100)
            : 0;

      options.onProgress?.({
        percent: Math.min(Math.max(percent, 0), 100),
        loadedBytes,
        totalBytes,
      });
    },
  });

  const contentType =
    typeof response.headers["content-type"] === "string"
      ? response.headers["content-type"]
      : "application/octet-stream";

  const contentDisposition =
    typeof response.headers["content-disposition"] === "string"
      ? response.headers["content-disposition"]
      : null;

  const blob =
    response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: contentType });

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = extractFileName(contentDisposition) ?? fallbackFileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);

  options.onProgress?.({
    percent: 100,
    loadedBytes: blob.size,
    totalBytes: blob.size,
  });
}

export async function downloadFrameJpg(
  frameId: string,
  options?: DownloadFileOptions,
) {
  await downloadFile(`/exports/frames/${frameId}/jpg`, `${frameId}.jpg`, options);
}

export async function downloadFramePdf(
  frameId: string,
  options?: DownloadFileOptions,
) {
  await downloadFile(`/exports/frames/${frameId}/pdf`, `${frameId}.pdf`, options);
}

export async function downloadCommunicationJpgZip(
  communicationId: string,
  options?: DownloadFileOptions,
) {
  await downloadFile(
    `/exports/communications/${communicationId}/jpg-zip`,
    `${communicationId}-quadros.zip`,
    options,
  );
}

export async function createCommunicationJpgZipJob(communicationId: string) {
  const { data } = await api.post<ExportJobInfo>(
    `/exports/communications/${communicationId}/jpg-zip-jobs`,
  );

  return data;
}

export async function createCommunicationPdfZipJob(communicationId: string) {
  const { data } = await api.post<ExportJobInfo>(
    `/exports/communications/${communicationId}/pdf-zip-jobs`,
  );

  return data;
}

export async function getExportJob(jobId: string) {
  const { data } = await api.get<ExportJobInfo>(`/exports/jobs/${jobId}`);
  return data;
}

export async function downloadExportJob(
  jobId: string,
  fallbackFileName: string,
  options?: DownloadFileOptions,
) {
  await downloadFile(`/exports/jobs/${jobId}/download`, fallbackFileName, options);
}

export async function downloadCommunicationPdf(
  communicationId: string,
  options?: DownloadFileOptions,
) {
  await downloadFile(
    `/exports/communications/${communicationId}/pdf-zip`,
    `${communicationId}-quadros-pdf.zip`,
    options,
  );
}
