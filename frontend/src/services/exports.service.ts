import { isAxiosError } from "axios";
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

async function extractBlobErrorMessage(error: unknown) {
  if (
    !isAxiosError(error) ||
    typeof Blob === "undefined" ||
    !(error.response?.data instanceof Blob)
  ) {
    return null;
  }

  const text = (await error.response.data.text()).trim();

  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as {
      message?: string | string[];
      error?: string;
    };

    if (Array.isArray(parsed.message)) {
      return parsed.message.join(", ");
    }

    if (typeof parsed.message === "string") {
      return parsed.message;
    }

    if (typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    if (text.length <= 300) {
      return text;
    }
  }

  return null;
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

  let response;

  try {
    response = await api.get<Blob>(path, {
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
  } catch (error) {
    const message = await extractBlobErrorMessage(error);

    if (message) {
      throw new Error(message);
    }

    throw error;
  }

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
  window.setTimeout(() => {
    window.URL.revokeObjectURL(downloadUrl);
  }, 1000);

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

export async function createFrameJpgJob(frameId: string) {
  const { data } = await api.post<ExportJobInfo>(
    `/exports/frames/${frameId}/jpg-jobs`,
  );

  return data;
}

export async function createFramePdfJob(frameId: string) {
  const { data } = await api.post<ExportJobInfo>(
    `/exports/frames/${frameId}/pdf-jobs`,
  );

  return data;
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
    `/exports/communications/${communicationId}/pdf`,
    `${communicationId}-quadros.pdf`,
    options,
  );
}

export async function downloadCommunicationPdfZip(
  communicationId: string,
  options?: DownloadFileOptions,
) {
  await downloadFile(
    `/exports/communications/${communicationId}/pdf-zip`,
    `${communicationId}-quadros-pdf.zip`,
    options,
  );
}
