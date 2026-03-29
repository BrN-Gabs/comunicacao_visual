import { api } from "@/lib/api";
import type {
  AuditLogFilterOptionsResponse,
  AuditLogsListParams,
  AuditLogsListResponse,
  AuditLogsMonthlySummary,
} from "@/types/audit-log";

function extractFileName(contentDisposition?: string | null) {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const classicMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return classicMatch?.[1] ?? null;
}

async function downloadAuditLogFile(
  path: string,
  fallbackFileName: string,
  params?: Record<string, string | number | undefined>,
) {
  const response = await api.get<Blob>(path, {
    params,
    responseType: "blob",
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
}

export async function listAuditLogs(params: AuditLogsListParams = {}) {
  const { data } = await api.get<AuditLogsListResponse>("/audit-logs", {
    params,
  });

  return data;
}

export async function getAuditLogFilterOptions() {
  const { data } = await api.get<AuditLogFilterOptionsResponse>(
    "/audit-logs/filter-options",
  );

  return data;
}

export async function getAuditLogsMonthlySummary(year: number, month: number) {
  const { data } = await api.get<AuditLogsMonthlySummary>(
    "/audit-logs/monthly-summary",
    {
      params: { year, month },
    },
  );

  return data;
}

export async function downloadAuditLogsCsv(params: AuditLogsListParams = {}) {
  await downloadAuditLogFile("/audit-logs/report.csv", "relatorio-logs.csv", params);
}

export async function downloadAuditLogsMonthlySummaryCsv(
  year: number,
  month: number,
) {
  await downloadAuditLogFile(
    "/audit-logs/monthly-summary/report.csv",
    `resumo-logs-${year}-${String(month).padStart(2, "0")}.csv`,
    { year, month },
  );
}
