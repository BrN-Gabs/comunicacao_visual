"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/layout/app-modal";
import { AppLayout } from "@/components/layout/app-layout";
import { DownloadIcon } from "@/components/layout/download-icon";
import { NoticeIcon } from "@/components/layout/notice-icon";
import { PageTitleCard } from "@/components/layout/page-title";
import { RefreshIcon } from "@/components/layout/refresh-icon";
import { SearchIcon } from "@/components/layout/search-icon";
import { logsPage } from "@/components/layout/page-registry";
import { TransitionLink } from "@/components/transition/transition-link";
import { useRouteTransition } from "@/components/transition/route-transition-provider";
import { useAuthGuard } from "@/hooks/use-auth";
import { getApiMessage } from "@/lib/api-error";
import { getStoredUser } from "@/lib/auth";
import { subscribeToAppRefresh } from "@/lib/app-refresh";
import {
  downloadAuditLogsCsv,
  downloadAuditLogsMonthlySummaryCsv,
  getAuditLogFilterOptions,
  getAuditLogsMonthlySummary,
  listAuditLogs,
} from "@/services/audit-logs.service";
import type {
  AuditLogFilterOptionsResponse,
  AuditLogItem,
  AuditLogsListParams,
  AuditLogsListResponse,
  AuditLogsMonthlySummary,
} from "@/types/audit-log";

type ErrorModalState = {
  title: string;
  message: string;
} | null;

const moduleLabelMap: Record<string, string> = {
  AUTH: "Autenticação",
  COMMUNICATIONS: "Comunicações",
  FRAMES: "Quadros",
  CITY_LIBRARY: "Biblioteca da cidade",
  CITY_IMAGES: "Imagens da cidade",
  GAZIN_LIBRARY: "Biblioteca Gazin",
  PROJECT_GAZIN_IMAGES: "Imagens Gazin do projeto",
  USERS: "Usuários",
  EXPORTS: "Exportações",
  DASHBOARD: "Dashboard",
};

const entityTypeLabelMap: Record<string, string> = {
  COMMUNICATION: "Comunicação",
  WALL: "Parede",
  FRAME: "Quadro",
  CITY: "Cidade",
  PHOTOGRAPHER: "Fotógrafo",
  USER: "Usuário",
  PROJECT_CITY_IMAGE: "Imagem da cidade",
  PROJECT_GAZIN_IMAGE: "Imagem Gazin do projeto",
  GAZIN_LIBRARY_IMAGE: "Imagem da biblioteca Gazin",
  CITY_LIBRARY_IMAGE: "Imagem da biblioteca da cidade",
  PASSWORD_RESET: "Recuperação de senha",
  SESSION: "Sessão",
};

const actionLabelMap: Record<string, string> = {
  CREATE: "Criação",
  UPDATE: "Atualização",
  DELETE: "Exclusão",
  ADD_WALL: "Adicionar parede",
  ADD_FRAME: "Adicionar quadro",
  DELETE_WALL: "Excluir parede",
  FINALIZE: "Finalização",
  VALIDATE: "Validação",
  DIVERGE: "Divergência",
  ASSIGN_IMAGES: "Distribuir imagens",
  SWAP_CITY_IMAGE: "Trocar imagem da cidade",
  SWAP_GAZIN_IMAGE: "Trocar imagem Gazin",
  UPDATE_DIMENSIONS: "Atualizar medidas",
  UPDATE_IMAGE_LAYOUT: "Atualizar enquadramento",
  CREATE_CITY: "Criar cidade",
  UPDATE_CITY: "Atualizar cidade",
  DELETE_CITY: "Excluir cidade",
  CREATE_PHOTOGRAPHER: "Criar fotógrafo",
  UPDATE_PHOTOGRAPHER: "Atualizar fotógrafo",
  DELETE_PHOTOGRAPHER: "Excluir fotógrafo",
  UPLOAD_IMAGES: "Upload de imagens",
  REUPLOAD_IMAGE: "Reenviar imagem",
  DELETE_IMAGE: "Excluir imagem",
  CREATE_MANY: "Criação em lote",
  UPLOAD_CREATE: "Upload e criação",
  REUPLOAD: "Reenviar arquivo",
  UPDATE_STATUS: "Atualizar status",
  UPDATE_ROLE: "Atualizar perfil",
  SYNC_FROM_LIBRARY: "Sincronizar da biblioteca",
  EXPORT_FRAME_JPG: "Exportar quadro JPG",
  EXPORT_FRAME_PDF: "Exportar quadro PDF",
  EXPORT_COMMUNICATION_JPG_ZIP: "Exportar comunicação JPG ZIP",
  EXPORT_COMMUNICATION_PDF: "Exportar comunicação PDF",
  EXPORT_COMMUNICATION_PDF_ZIP: "Exportar comunicação PDF ZIP",
  CLEAR_RECENT_EXPORTS: "Limpar exportações recentes",
  LOGIN: "Login",
  LOGOUT: "Logout",
  REQUEST_PASSWORD_RESET: "Solicitar redefinição de senha",
  RESET_PASSWORD: "Redefinir senha",
};

const roleLabelMap: Record<string, string> = {
  ADMIN: "Admin",
  VIP: "VIP",
  NORMAL: "Normal",
};

function formatTokenLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatModuleLabel(value: string) {
  return moduleLabelMap[value] ?? formatTokenLabel(value);
}

function formatActionLabel(value: string) {
  return actionLabelMap[value] ?? formatTokenLabel(value);
}

function formatEntityTypeLabel(value: string) {
  return entityTypeLabelMap[value] ?? formatTokenLabel(value);
}

function formatRoleLabel(value: string | null | undefined) {
  if (!value) {
    return "Sistema";
  }

  return roleLabelMap[value] ?? formatTokenLabel(value);
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatShortDate(value: string | Date | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("pt-BR", {
    dateStyle: "short",
  });
}

function formatMonthInputValue(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function parseMonthInput(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null;
  }

  if (month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

function formatMonthLabel(value: string) {
  const parsed = parseMonthInput(value);

  if (!parsed) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(parsed.year, parsed.month - 1, 1));
}

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getMetadataString(metadata: unknown, key: string) {
  if (!isRecord(metadata)) {
    return null;
  }

  const value = metadata[key];

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return null;
}

function getRelatedHref(log: AuditLogItem) {
  if (log.entityType === "COMMUNICATION" && log.entityId) {
    return `/communications/${log.entityId}`;
  }

  const communicationId = getMetadataString(log.metadata, "communicationId");

  if (communicationId) {
    return `/communications/${communicationId}`;
  }

  if (log.module === "USERS" || log.entityType === "USER") {
    return "/users";
  }

  if (log.module === "GAZIN_LIBRARY") {
    return "/gazin-library";
  }

  if (log.module === "CITY_LIBRARY" || log.module === "CITY_IMAGES") {
    return "/city-library";
  }

  if (log.module === "EXPORTS" || log.module === "DASHBOARD") {
    return "/dashboard";
  }

  return null;
}

function getReferenceLabel(log: AuditLogItem) {
  if (log.entityLabel?.trim()) {
    return log.entityLabel.trim();
  }

  if (log.entityId?.trim()) {
    return `ID ${log.entityId.trim()}`;
  }

  return "Sem referencia";
}

function formatMetadata(value: unknown) {
  if (value === null || value === undefined) {
    return "Sem metadados registrados.";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildFiltersState(
  searchTerm: string,
  moduleFilter: string,
  actionFilter: string,
  entityTypeFilter: string,
  userIdFilter: string,
  entityIdFilter: string,
  startDateFilter: string,
  endDateFilter: string,
  limitFilter: number,
): AuditLogsListParams {
  return {
    search: searchTerm.trim() || undefined,
    module: moduleFilter || undefined,
    action: actionFilter || undefined,
    entityType: entityTypeFilter || undefined,
    userId: userIdFilter || undefined,
    entityId: entityIdFilter.trim() || undefined,
    startDate: startDateFilter || undefined,
    endDate: endDateFilter || undefined,
    limit: limitFilter,
  };
}

export default function LogsPage() {
  const router = useRouter();
  const { startRouteTransition } = useRouteTransition();
  const { isReady } = useAuthGuard();
  const storedUser = getStoredUser();
  const currentUserRole = storedUser.role ?? null;
  const defaultMonth = useMemo(() => formatMonthInputValue(new Date()), []);

  const [refreshVersion, setRefreshVersion] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [entityIdFilter, setEntityIdFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [limitFilter, setLimitFilter] = useState(20);
  const [appliedFilters, setAppliedFilters] = useState<AuditLogsListParams>({
    limit: 20,
  });
  const [currentPage, setCurrentPage] = useState(1);

  const [filterOptions, setFilterOptions] =
    useState<AuditLogFilterOptionsResponse | null>(null);
  const [isLoadingFilterOptions, setIsLoadingFilterOptions] = useState(true);
  const [filterOptionsError, setFilterOptionsError] = useState("");

  const [logsData, setLogsData] = useState<AuditLogsListResponse | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState("");

  const [summaryMonthInput, setSummaryMonthInput] = useState(defaultMonth);
  const [appliedSummaryMonth, setAppliedSummaryMonth] = useState(defaultMonth);
  const [monthlySummary, setMonthlySummary] =
    useState<AuditLogsMonthlySummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const [isDownloadingFilteredReport, setIsDownloadingFilteredReport] =
    useState(false);
  const [isDownloadingMonthlyReport, setIsDownloadingMonthlyReport] =
    useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [errorModal, setErrorModal] = useState<ErrorModalState>(null);

  useEffect(() => {
    return subscribeToAppRefresh(() => {
      setRefreshVersion((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (currentUserRole !== "ADMIN") {
      startRouteTransition({
        label: "Voltando ao dashboard",
        minDuration: 700,
      });
      router.replace("/dashboard");
    }
  }, [currentUserRole, isReady, router, startRouteTransition]);

  const loadFilterOptions = useCallback(async () => {
    if (!isReady || currentUserRole !== "ADMIN") {
      return;
    }

    setIsLoadingFilterOptions(true);
    setFilterOptionsError("");

    try {
      const response = await getAuditLogFilterOptions();
      setFilterOptions(response);
    } catch (error) {
      setFilterOptionsError(
        getApiMessage(error, "Não foi possível carregar os filtros de logs."),
      );
    } finally {
      setIsLoadingFilterOptions(false);
    }
  }, [currentUserRole, isReady]);

  const loadLogs = useCallback(async () => {
    if (!isReady || currentUserRole !== "ADMIN") {
      return;
    }

    setIsLoadingLogs(true);
    setLogsError("");

    try {
      const response = await listAuditLogs({
        ...appliedFilters,
        page: currentPage,
      });

      setLogsData(response);
    } catch (error) {
      setLogsError(
        getApiMessage(error, "Não foi possível carregar os logs do sistema."),
      );
    } finally {
      setIsLoadingLogs(false);
    }
  }, [appliedFilters, currentPage, currentUserRole, isReady]);

  const loadMonthlySummary = useCallback(async () => {
    if (!isReady || currentUserRole !== "ADMIN") {
      return;
    }

    const parsedMonth = parseMonthInput(appliedSummaryMonth);

    if (!parsedMonth) {
      setSummaryError("Selecione um mês válido para gerar o resumo.");
      setIsLoadingSummary(false);
      return;
    }

    setIsLoadingSummary(true);
    setSummaryError("");

    try {
      const response = await getAuditLogsMonthlySummary(
        parsedMonth.year,
        parsedMonth.month,
      );

      setMonthlySummary(response);
    } catch (error) {
      setSummaryError(
        getApiMessage(error, "Não foi possível carregar o resumo mensal."),
      );
    } finally {
      setIsLoadingSummary(false);
    }
  }, [appliedSummaryMonth, currentUserRole, isReady]);

  useEffect(() => {
    void loadFilterOptions();
  }, [loadFilterOptions, refreshVersion]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs, refreshVersion]);

  useEffect(() => {
    void loadMonthlySummary();
  }, [loadMonthlySummary, refreshVersion]);

  function openErrorModal(title: string, message: string) {
    setErrorModal({ title, message });
  }

  function handleApplyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setCurrentPage(1);
    setAppliedFilters(
      buildFiltersState(
        searchTerm,
        moduleFilter,
        actionFilter,
        entityTypeFilter,
        userIdFilter,
        entityIdFilter,
        startDateFilter,
        endDateFilter,
        limitFilter,
      ),
    );
  }

  function handleClearFilters() {
    setSearchTerm("");
    setModuleFilter("");
    setActionFilter("");
    setEntityTypeFilter("");
    setUserIdFilter("");
    setEntityIdFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
    setLimitFilter(20);
    setCurrentPage(1);
    setAppliedFilters({ limit: 20 });
  }

  function handleApplySummaryMonth() {
    if (!parseMonthInput(summaryMonthInput)) {
      openErrorModal(
        "Mês inválido",
        "Selecione um mês válido para gerar o resumo mensal.",
      );
      return;
    }

    setAppliedSummaryMonth(summaryMonthInput);
  }

  async function handleDownloadFilteredReport() {
    setIsDownloadingFilteredReport(true);

    try {
      await downloadAuditLogsCsv(appliedFilters);
    } catch (error) {
      openErrorModal(
        "Não foi possível baixar o relatório",
        getApiMessage(error, "Não foi possível baixar o CSV filtrado."),
      );
    } finally {
      setIsDownloadingFilteredReport(false);
    }
  }

  async function handleDownloadMonthlyReport() {
    const parsedMonth = parseMonthInput(appliedSummaryMonth);

    if (!parsedMonth) {
      openErrorModal(
        "Resumo indisponível",
        "Selecione um mês válido antes de baixar o resumo mensal.",
      );
      return;
    }

    setIsDownloadingMonthlyReport(true);

    try {
      await downloadAuditLogsMonthlySummaryCsv(
        parsedMonth.year,
        parsedMonth.month,
      );
    } catch (error) {
      openErrorModal(
        "Não foi possível baixar o resumo",
        getApiMessage(error, "Não foi possível baixar o resumo mensal."),
      );
    } finally {
      setIsDownloadingMonthlyReport(false);
    }
  }

  function handleRefreshPage() {
    setRefreshVersion((current) => current + 1);
  }

  function closeDetailsModal() {
    setSelectedLog(null);
  }

  function closeErrorModal() {
    setErrorModal(null);
  }

  const logsItems = logsData?.items ?? [];
  const logsMeta = logsData?.meta ?? {
    total: 0,
    page: currentPage,
    limit: appliedFilters.limit ?? 20,
    totalPages: 0,
  };

  const activeFiltersCount = [
    appliedFilters.search,
    appliedFilters.module,
    appliedFilters.action,
    appliedFilters.entityType,
    appliedFilters.userId,
    appliedFilters.entityId,
    appliedFilters.startDate,
    appliedFilters.endDate,
  ].filter(Boolean).length;

  const latestLogDate =
    logsItems[0]?.createdAt ?? filterOptions?.dateRange.newestAt ?? null;
  const oldestLogDate = filterOptions?.dateRange.oldestAt ?? null;
  const summaryModuleEntries = useMemo(
    () =>
      Object.entries(monthlySummary?.byModule ?? {}).sort(
        (left, right) => right[1] - left[1],
      ),
    [monthlySummary],
  );
  const summaryActionEntries = useMemo(
    () =>
      Object.entries(monthlySummary?.byAction ?? {}).sort(
        (left, right) => right[1] - left[1],
      ),
    [monthlySummary],
  );
  const selectedLogHref = selectedLog ? getRelatedHref(selectedLog) : null;
  const selectedLogMetadata = selectedLog
    ? formatMetadata(selectedLog.metadata)
    : "";
  const summaryMonthRangeLabel = monthlySummary
    ? `${formatShortDate(monthlySummary.period.start)} ate ${formatShortDate(
        monthlySummary.period.end,
      )}`
    : "-";
  const minSummaryMonth = oldestLogDate
    ? formatMonthInputValue(oldestLogDate)
    : undefined;
  const maxSummaryMonth = filterOptions?.dateRange.newestAt
    ? formatMonthInputValue(filterOptions.dateRange.newestAt)
    : undefined;

  if (!isReady || currentUserRole !== "ADMIN") {
    return null;
  }

  return (
    <AppLayout>
      <PageTitleCard
        page={logsPage}
        description="Central administrativa para auditar eventos, filtrar movimentações e baixar relatórios do sistema."
        actions={
          <>
            <button
              className="btn btn-secondary btn-with-icon"
              type="button"
              onClick={handleRefreshPage}
              disabled={
                isLoadingFilterOptions || isLoadingLogs || isLoadingSummary
              }
            >
              <RefreshIcon />
              Atualizar
            </button>
            <button
              className="btn btn-primary btn-with-icon"
              type="button"
              onClick={handleDownloadFilteredReport}
              disabled={isDownloadingFilteredReport}
            >
              <DownloadIcon />
              {isDownloadingFilteredReport
                ? "Baixando CSV..."
                : "Baixar CSV filtrado"}
            </button>
          </>
        }
      />

      <section className="logs-layout">
        <div className="panel panel-span-full">
          <div className="panel-header panel-header-inline">
            <div>
              <h3>Filtros completos</h3>
              <p>
                Cruze modulo, ação, entidade, usuário, datas e palavras-chave
                para montar relatórios bem detalhados.
              </p>
            </div>
            <div className="panel-header-actions">
              <span className="user-list-meta">
                {activeFiltersCount} filtro(s) ativo(s)
              </span>
              <span className="user-list-meta">
                Base desde {formatShortDate(oldestLogDate)}
              </span>
            </div>
          </div>

          <form className="logs-filters-form" onSubmit={handleApplyFilters}>
            <div className="logs-filters-grid">
              <label className="field-stack">
                <span>Busca geral</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Descrição, referência, usuário ou ação"
                />
              </label>

              <label className="field-stack">
                <span>Módulo</span>
                <select
                  className="app-select"
                  value={moduleFilter}
                  onChange={(event) => setModuleFilter(event.target.value)}
                  disabled={isLoadingFilterOptions}
                >
                  <option value="">Todos os módulos</option>
                  {filterOptions?.modules.map((item) => (
                    <option key={item} value={item}>
                      {formatModuleLabel(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack">
                <span>Ação</span>
                <select
                  className="app-select"
                  value={actionFilter}
                  onChange={(event) => setActionFilter(event.target.value)}
                  disabled={isLoadingFilterOptions}
                >
                  <option value="">Todas as ações</option>
                  {filterOptions?.actions.map((item) => (
                    <option key={item} value={item}>
                      {formatActionLabel(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack">
                <span>Tipo de entidade</span>
                <select
                  className="app-select"
                  value={entityTypeFilter}
                  onChange={(event) => setEntityTypeFilter(event.target.value)}
                  disabled={isLoadingFilterOptions}
                >
                  <option value="">Todas as entidades</option>
                  {filterOptions?.entityTypes.map((item) => (
                    <option key={item} value={item}>
                      {formatEntityTypeLabel(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack">
                <span>Usuário</span>
                <select
                  className="app-select"
                  value={userIdFilter}
                  onChange={(event) => setUserIdFilter(event.target.value)}
                  disabled={isLoadingFilterOptions}
                >
                  <option value="">Todos os usuários</option>
                  {filterOptions?.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} - {formatRoleLabel(user.role)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack">
                <span>ID da entidade</span>
                <input
                  type="text"
                  value={entityIdFilter}
                  onChange={(event) => setEntityIdFilter(event.target.value)}
                  placeholder="Buscar por ID parcial"
                />
              </label>

              <label className="field-stack">
                <span>Data inicial</span>
                <input
                  type="date"
                  value={startDateFilter}
                  min={oldestLogDate ? String(oldestLogDate).slice(0, 10) : ""}
                  max={endDateFilter || undefined}
                  onChange={(event) => setStartDateFilter(event.target.value)}
                />
              </label>

              <label className="field-stack">
                <span>Data final</span>
                <input
                  type="date"
                  value={endDateFilter}
                  min={startDateFilter || undefined}
                  max={
                    filterOptions?.dateRange.newestAt
                      ? String(filterOptions.dateRange.newestAt).slice(0, 10)
                      : undefined
                  }
                  onChange={(event) => setEndDateFilter(event.target.value)}
                />
              </label>

              <label className="field-stack">
                <span>Registros por página</span>
                <select
                  className="app-select"
                  value={String(limitFilter)}
                  onChange={(event) => setLimitFilter(Number(event.target.value))}
                >
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
            </div>

            {filterOptionsError ? (
              <div className="inline-feedback error" role="alert">
                {filterOptionsError}
              </div>
            ) : null}

            <div className="logs-filter-actions">
              <span className="logs-filter-meta">
                Ultima atividade conhecida: {formatDateTime(latestLogDate)}
              </span>

              <div className="logs-filter-action-buttons">
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={handleClearFilters}
                >
                  Limpar filtros
                </button>
                <button className="btn btn-primary btn-with-icon" type="submit">
                  <SearchIcon />
                  Aplicar filtros
                </button>
              </div>
            </div>
          </form>
        </div>

        <section className="logs-summary-grid">
          <article className="logs-summary-card">
            <span>Registros filtrados</span>
            <strong>{formatCount(logsMeta.total)}</strong>
            <p>Resultado da consulta atual.</p>
          </article>

          <article className="logs-summary-card">
            <span>Módulos rastreados</span>
            <strong>{formatCount(filterOptions?.modules.length ?? 0)}</strong>
            <p>Telas e áreas com auditoria ativa.</p>
          </article>

          <article className="logs-summary-card">
            <span>Usuários com histórico</span>
            <strong>{formatCount(filterOptions?.users.length ?? 0)}</strong>
            <p>Pessoas com movimentação registrada.</p>
          </article>

          <article className="logs-summary-card">
            <span>Mês em foco</span>
            <strong>{formatMonthLabel(appliedSummaryMonth)}</strong>
            <p>Janela usada no resumo consolidado.</p>
          </article>
        </section>

        <section className="logs-report-grid">
          <div className="panel">
            <div className="panel-header panel-header-inline">
              <div>
                <h3>Resumo mensal</h3>
                <p>
                  Consolide validações, divergências, exportações e demais
                  movimentos do sistema por mês.
                </p>
              </div>

              <div className="logs-report-actions">
                <label className="field-stack logs-month-field">
                  <span>Mês</span>
                  <input
                    type="month"
                    value={summaryMonthInput}
                    min={minSummaryMonth}
                    max={maxSummaryMonth}
                    onChange={(event) =>
                      setSummaryMonthInput(event.target.value)
                    }
                  />
                </label>

                <button
                  className="btn btn-secondary btn-with-icon"
                  type="button"
                  onClick={handleApplySummaryMonth}
                  disabled={isLoadingSummary}
                >
                  <RefreshIcon />
                  Carregar
                </button>

                <button
                  className="btn btn-primary btn-with-icon"
                  type="button"
                  onClick={handleDownloadMonthlyReport}
                  disabled={isDownloadingMonthlyReport}
                >
                  <DownloadIcon />
                  {isDownloadingMonthlyReport
                    ? "Baixando..."
                    : "Baixar resumo CSV"}
                </button>
              </div>
            </div>

            <div className="logs-report-body">
              {isLoadingSummary ? (
                <div className="empty-state">Carregando resumo mensal...</div>
              ) : null}

              {!isLoadingSummary && summaryError ? (
                <div className="inline-feedback error" role="alert">
                  {summaryError}
                </div>
              ) : null}

              {!isLoadingSummary &&
              !summaryError &&
              monthlySummary &&
              monthlySummary.total === 0 ? (
                <div className="logs-empty-note">
                  Nenhum evento encontrado para {formatMonthLabel(appliedSummaryMonth)}.
                </div>
              ) : null}

              {!isLoadingSummary &&
              !summaryError &&
              monthlySummary &&
              monthlySummary.total > 0 ? (
                <>
                  <div className="logs-kpi-grid">
                    <article className="logs-kpi-card">
                      <span>Total de ações</span>
                      <strong>{formatCount(monthlySummary.total)}</strong>
                    </article>
                    <article className="logs-kpi-card">
                      <span>Comunicações finalizadas</span>
                      <strong>
                        {formatCount(monthlySummary.communications.finalized)}
                      </strong>
                    </article>
                    <article className="logs-kpi-card">
                      <span>Comunicações validadas</span>
                      <strong>
                        {formatCount(monthlySummary.communications.validated)}
                      </strong>
                    </article>
                    <article className="logs-kpi-card">
                      <span>Comunicações divergentes</span>
                      <strong>
                        {formatCount(monthlySummary.communications.diverged)}
                      </strong>
                    </article>
                  </div>

                  <div className="logs-stats-grid">
                    <article className="logs-stat-card">
                      <h4>Comunicações</h4>
                      <ul className="logs-stat-list">
                        <li>
                          <span>Criadas</span>
                          <strong>
                            {formatCount(monthlySummary.communications.created)}
                          </strong>
                        </li>
                        <li>
                          <span>Atualizadas</span>
                          <strong>
                            {formatCount(monthlySummary.communications.updated)}
                          </strong>
                        </li>
                        <li>
                          <span>Excluidas</span>
                          <strong>
                            {formatCount(monthlySummary.communications.deleted)}
                          </strong>
                        </li>
                        <li>
                          <span>Imagens redistribuidas</span>
                          <strong>
                            {formatCount(
                              monthlySummary.communications.assignedImages,
                            )}
                          </strong>
                        </li>
                      </ul>
                    </article>

                    <article className="logs-stat-card">
                      <h4>Quadros</h4>
                      <ul className="logs-stat-list">
                        <li>
                          <span>Troca de imagem da cidade</span>
                          <strong>
                            {formatCount(monthlySummary.frames.swapCityImage)}
                          </strong>
                        </li>
                        <li>
                          <span>Troca de imagem Gazin</span>
                          <strong>
                            {formatCount(monthlySummary.frames.swapGazinImage)}
                          </strong>
                        </li>
                        <li>
                          <span>Ajuste de medidas</span>
                          <strong>
                            {formatCount(monthlySummary.frames.updateDimensions)}
                          </strong>
                        </li>
                      </ul>
                    </article>

                    <article className="logs-stat-card">
                      <h4>Bibliotecas e acervos</h4>
                      <ul className="logs-stat-list">
                        <li>
                          <span>Uploads Gazin</span>
                          <strong>
                            {formatCount(monthlySummary.gazinLibrary.created)}
                          </strong>
                        </li>
                        <li>
                          <span>Status Gazin alterado</span>
                          <strong>
                            {formatCount(
                              monthlySummary.gazinLibrary.updatedStatus,
                            )}
                          </strong>
                        </li>
                        <li>
                          <span>Imagens da cidade em lote</span>
                          <strong>
                            {formatCount(monthlySummary.cityImages.createdMany)}
                          </strong>
                        </li>
                        <li>
                          <span>Sincronização Gazin do projeto</span>
                          <strong>
                            {formatCount(
                              monthlySummary.projectGazinImages.synced,
                            )}
                          </strong>
                        </li>
                      </ul>
                    </article>

                    <article className="logs-stat-card">
                      <h4>Usuarios</h4>
                      <ul className="logs-stat-list">
                        <li>
                          <span>Criados</span>
                          <strong>
                            {formatCount(monthlySummary.users.created)}
                          </strong>
                        </li>
                        <li>
                          <span>Perfis alterados</span>
                          <strong>
                            {formatCount(monthlySummary.users.updatedRole)}
                          </strong>
                        </li>
                        <li>
                          <span>Status alterado</span>
                          <strong>
                            {formatCount(monthlySummary.users.updatedStatus)}
                          </strong>
                        </li>
                      </ul>
                    </article>
                  </div>

                  <div className="logs-ranking-grid">
                    <article className="logs-stat-card">
                      <h4>Módulos mais movimentados</h4>
                      {summaryModuleEntries.length ? (
                        <ul className="logs-ranking-list">
                          {summaryModuleEntries.map(([key, value]) => (
                            <li key={key}>
                              <span>{formatModuleLabel(key)}</span>
                              <strong>{formatCount(value)}</strong>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="logs-empty-note">
                          Sem dados por módulo neste periodo.
                        </div>
                      )}
                    </article>

                    <article className="logs-stat-card">
                      <h4>Ações mais frequentes</h4>
                      {summaryActionEntries.length ? (
                        <ul className="logs-ranking-list">
                          {summaryActionEntries.slice(0, 10).map(([key, value]) => (
                            <li key={key}>
                              <span>{formatActionLabel(key)}</span>
                              <strong>{formatCount(value)}</strong>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="logs-empty-note">
                          Sem dados por ação neste período.
                        </div>
                      )}
                    </article>

                    <article className="logs-stat-card">
                      <h4>Usuários mais ativos</h4>
                      {monthlySummary.topUsers.length ? (
                        <ul className="logs-ranking-list">
                          {monthlySummary.topUsers.map((item) => (
                            <li key={item.userId ?? item.name}>
                              <div className="logs-user-meta">
                                <span>{item.name}</span>
                                <small>{formatRoleLabel(item.role)}</small>
                              </div>
                              <strong>{formatCount(item.totalActions)}</strong>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="logs-empty-note">
                          Nenhum usuário com movimentos neste período.
                        </div>
                      )}
                    </article>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header panel-header-inline">
              <div>
                <h3>Relatórios rápidos</h3>
                <p>
                  Baixe a visão filtrada, acompanhe a cobertura do histórico e
                  veja os módulos auditados.
                </p>
              </div>
              <button
                className="btn btn-secondary btn-with-icon"
                type="button"
                onClick={handleRefreshPage}
                disabled={
                  isLoadingFilterOptions || isLoadingLogs || isLoadingSummary
                }
              >
                <RefreshIcon />
                Atualizar dados
              </button>
            </div>

            <div className="logs-report-body">
              <div className="logs-kpi-grid is-compact">
                <article className="logs-kpi-card">
                  <span>Período base</span>
                  <strong>{summaryMonthRangeLabel}</strong>
                </article>
                <article className="logs-kpi-card">
                  <span>Último registro</span>
                  <strong>{formatDateTime(latestLogDate)}</strong>
                </article>
              </div>

              <article className="logs-stat-card">
                <h4>Downloads disponíveis</h4>
                <p className="logs-card-copy">
                  Gere um CSV da consulta atual ou um resumo consolidado do mês
                  selecionado.
                </p>
                <div className="logs-report-actions">
                  <button
                    className="btn btn-primary btn-with-icon"
                    type="button"
                    onClick={handleDownloadFilteredReport}
                    disabled={isDownloadingFilteredReport}
                  >
                    <DownloadIcon />
                    {isDownloadingFilteredReport
                      ? "Baixando..."
                      : "CSV da consulta"}
                  </button>

                  <button
                    className="btn btn-secondary btn-with-icon"
                    type="button"
                    onClick={handleDownloadMonthlyReport}
                    disabled={isDownloadingMonthlyReport}
                  >
                    <DownloadIcon />
                    {isDownloadingMonthlyReport
                      ? "Baixando..."
                      : "Resumo mensal CSV"}
                  </button>
                </div>
              </article>

              <article className="logs-stat-card">
                <h4>Modulos com auditoria</h4>
                <div className="logs-module-tags">
                  {filterOptions?.modules.length ? (
                    filterOptions.modules.map((module) => (
                      <span key={module} className="logs-module-tag">
                        {formatModuleLabel(module)}
                      </span>
                    ))
                  ) : (
                    <span className="logs-module-tag">Sem módulos carregados</span>
                  )}
                </div>
              </article>

              <article className="logs-stat-card">
                <h4>Leitura rápida da consulta</h4>
                <ul className="logs-stat-list">
                  <li>
                    <span>Registros retornados</span>
                    <strong>{formatCount(logsMeta.total)}</strong>
                  </li>
                  <li>
                    <span>Página atual</span>
                    <strong>
                      {logsMeta.totalPages > 0 ? logsMeta.page : 0} de{" "}
                      {logsMeta.totalPages}
                    </strong>
                  </li>
                  <li>
                    <span>Filtros ativos</span>
                    <strong>{formatCount(activeFiltersCount)}</strong>
                  </li>
                  <li>
                    <span>Usuários com histórico</span>
                    <strong>{formatCount(filterOptions?.users.length ?? 0)}</strong>
                  </li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <div className="panel panel-span-full">
          <div className="panel-header panel-header-inline">
            <div>
              <h3>Auditoria detalhada</h3>
              <p>
                Inspecione cada evento do sistema e abra a tela relacionada
                quando houver referência navegável.
              </p>
            </div>

            <div className="panel-header-actions">
              <span className="user-list-meta">
                {formatCount(logsMeta.total)} registro(s)
              </span>
              <button
                className="btn btn-secondary btn-with-icon"
                type="button"
                onClick={handleDownloadFilteredReport}
                disabled={isDownloadingFilteredReport}
              >
                <DownloadIcon />
                Exportar tabela
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Módulo</th>
                  <th>Ação</th>
                  <th>Entidade</th>
                  <th>Referência</th>
                  <th>Usuário</th>
                  <th>Descrição</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingLogs ? (
                  <tr>
                    <td className="table-feedback" colSpan={8}>
                      Carregando logs do sistema...
                    </td>
                  </tr>
                ) : null}

                {!isLoadingLogs && logsError ? (
                  <tr>
                    <td className="table-feedback error" colSpan={8}>
                      {logsError}
                    </td>
                  </tr>
                ) : null}

                {!isLoadingLogs && !logsError && logsItems.length === 0 ? (
                  <tr>
                    <td className="table-feedback" colSpan={8}>
                      Nenhum log encontrado para os filtros atuais.
                    </td>
                  </tr>
                ) : null}

                {!isLoadingLogs &&
                  !logsError &&
                  logsItems.map((log) => {
                    const relatedHref = getRelatedHref(log);

                    return (
                      <tr key={log.id}>
                        <td>{formatDateTime(log.createdAt)}</td>
                        <td>
                          <div className="table-title-cell">
                            <strong>{formatModuleLabel(log.module)}</strong>
                            <span>{log.module}</span>
                          </div>
                        </td>
                        <td>{formatActionLabel(log.action)}</td>
                        <td>{formatEntityTypeLabel(log.entityType)}</td>
                        <td className="logs-table-reference">
                          {relatedHref ? (
                            <TransitionLink
                              href={relatedHref}
                              loadingLabel="Abrindo tela relacionada"
                              minDuration={680}
                              className="table-link"
                            >
                              {getReferenceLabel(log)}
                            </TransitionLink>
                          ) : (
                            <strong>{getReferenceLabel(log)}</strong>
                          )}
                          {log.entityId ? <span>ID: {log.entityId}</span> : null}
                        </td>
                        <td>
                          <div className="table-title-cell">
                            <strong>{log.user?.name ?? "Sistema"}</strong>
                            <span>{formatRoleLabel(log.user?.role)}</span>
                          </div>
                        </td>
                        <td className="logs-table-description">
                          {log.description}
                        </td>
                        <td className="logs-table-action-cell">
                          <button
                            className="table-link"
                            type="button"
                            onClick={() => setSelectedLog(log)}
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="logs-pagination">
            <span className="logs-pagination-meta">
              Pagina {logsMeta.totalPages > 0 ? logsMeta.page : 0} de{" "}
              {logsMeta.totalPages} com {formatCount(logsMeta.limit)} itens por
              pagina.
            </span>

            <div className="logs-pagination-actions">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  setCurrentPage((current) => Math.max(1, current - 1))
                }
                disabled={isLoadingLogs || currentPage <= 1}
              >
                Página anterior
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  setCurrentPage((current) =>
                    Math.min(logsMeta.totalPages || current, current + 1),
                  )
                }
                disabled={
                  isLoadingLogs ||
                  logsMeta.totalPages === 0 ||
                  currentPage >= logsMeta.totalPages
                }
              >
                Próxima página
              </button>
            </div>
          </div>
        </div>
      </section>

      <AppModal
        open={Boolean(selectedLog)}
        title="Detalhes do log"
        description={
          selectedLog
            ? `Evento registrado em ${formatDateTime(selectedLog.createdAt)}.`
            : ""
        }
        size="xlarge"
        variant="info"
        icon={<NoticeIcon />}
        onClose={closeDetailsModal}
        secondaryAction={{
          label: "Fechar",
          onClick: closeDetailsModal,
        }}
      >
        {selectedLog ? (
          <>
            <div className="logs-detail-grid">
              <article className="logs-detail-card">
                <span>Módulo</span>
                <strong>{formatModuleLabel(selectedLog.module)}</strong>
                <p>{selectedLog.module}</p>
              </article>

              <article className="logs-detail-card">
                <span>Ação</span>
                <strong>{formatActionLabel(selectedLog.action)}</strong>
                <p>{selectedLog.action}</p>
              </article>

              <article className="logs-detail-card">
                <span>Entidade</span>
                <strong>{formatEntityTypeLabel(selectedLog.entityType)}</strong>
                <p>{selectedLog.entityId ?? "Sem ID"}</p>
              </article>

              <article className="logs-detail-card">
                <span>Usuário</span>
                <strong>{selectedLog.user?.name ?? "Sistema"}</strong>
                <p>{formatRoleLabel(selectedLog.user?.role)}</p>
              </article>

              <article className="logs-detail-card">
                <span>Referência</span>
                <strong>{getReferenceLabel(selectedLog)}</strong>
                <p>{selectedLog.entityLabel ?? "Sem rótulo registrado"}</p>
              </article>

              <article className="logs-detail-card">
                <span>Data/Hora</span>
                <strong>{formatDateTime(selectedLog.createdAt)}</strong>
                <p>ID do log: {selectedLog.id}</p>
              </article>
            </div>

            <article className="logs-detail-card">
              <span>Descrição</span>
              <strong>Resumo operacional</strong>
              <p>{selectedLog.description}</p>
            </article>

            <article className="logs-detail-card logs-metadata-card">
              <span>Metadados</span>
              <strong>Payload registrado</strong>
              <pre>{selectedLogMetadata}</pre>
            </article>

            {selectedLogHref ? (
              <div className="logs-modal-actions">
                <TransitionLink
                  href={selectedLogHref}
                  loadingLabel="Abrindo tela relacionada"
                  minDuration={700}
                  className="btn btn-secondary"
                >
                  Abrir tela relacionada
                </TransitionLink>
              </div>
            ) : null}
          </>
        ) : null}
      </AppModal>

      <AppModal
        open={Boolean(errorModal)}
        title={errorModal?.title ?? ""}
        description={errorModal?.message ?? ""}
        variant="warning"
        icon={<NoticeIcon />}
        onClose={closeErrorModal}
        secondaryAction={{
          label: "Fechar",
          onClick: closeErrorModal,
        }}
      />
    </AppLayout>
  );
}
