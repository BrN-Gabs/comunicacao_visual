"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppModal } from "@/components/layout/app-modal";
import { AppLayout } from "@/components/layout/app-layout";
import { CommunicationExportPreview } from "@/components/communications/communication-export-preview";
import { DownloadIcon } from "@/components/layout/download-icon";
import { EditIcon } from "@/components/layout/edit-icon";
import { NoticeIcon } from "@/components/layout/notice-icon";
import { PageTitleCard } from "@/components/layout/page-title";
import { communicationDetailsPage } from "@/components/layout/page-registry";
import { PlusIcon } from "@/components/layout/plus-icon";
import { StatusToggleIcon } from "@/components/layout/status-toggle-icon";
import { TrashIcon } from "@/components/layout/trash-icon";
import { useAuthGuard } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/lib/api-error";
import { resolveAssetUrl as buildImageSource } from "@/lib/app-urls";
import { getStoredUser } from "@/lib/auth";
import { subscribeToAppRefresh, triggerAppRefresh } from "@/lib/app-refresh";
import { listCommunicationCityImages } from "@/services/city-images.service";
import {
  addCommunicationFrame,
  addCommunicationWall,
  assignCommunicationImages,
  deleteCommunicationWall,
  divergeCommunication,
  finalizeCommunication,
  getCommunicationSummary,
  validateCommunication,
} from "@/services/communications.service";
import {
  createCommunicationJpgZipJob,
  createCommunicationPdfZipJob,
  type DownloadProgressInfo,
  downloadExportJob,
  downloadFrameJpg,
  downloadFramePdf,
  getExportJob,
} from "@/services/exports.service";
import {
  deleteFrame,
  swapFrameCityImage,
  swapFrameGazinImage,
  updateFrameDimensions,
  updateFrameImageLayout,
} from "@/services/frames.service";
import { listCommunicationGazinImages } from "@/services/project-gazin-images.service";
import type {
  CommunicationStatus,
  CommunicationSummaryResponse,
  ProjectCityImage,
  ProjectGazinImage,
} from "@/types/communication";

function measureValueLabel(value: string | number) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? "-" : parsed.toFixed(2).replace(".", ",");
}

function measureLabel(value: string | number) {
  const formatted = measureValueLabel(value);
  return formatted === "-" ? formatted : `${formatted} m`;
}

function parsePositive(value: string) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const units = ["KB", "MB", "GB"];
  let nextValue = value / 1024;
  let unitIndex = 0;

  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }

  return `${nextValue.toFixed(1).replace(".", ",")} ${units[unitIndex]}`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const DEFAULT_IMAGE_ZOOM = 1;
const DEFAULT_IMAGE_OFFSET = 0;

function clampImageZoom(value: number) {
  return Math.min(Math.max(value, 1), 3);
}

function clampImageOffset(value: number) {
  return Math.min(Math.max(value, -100), 100);
}

type PageModalState = {
  title: string;
  description: string;
  variant?: "warning" | "danger" | "success" | "info";
  confirmLabel?: string;
  confirmTone?: "primary" | "secondary" | "danger";
  onConfirm?: () => void | Promise<void>;
};

type DownloadProgressState = {
  title: string;
  description: string;
  percent: number;
  loadedBytes: number;
  totalBytes: number | null;
  metaLabel?: string;
};

const communicationStatusLabelMap: Record<CommunicationStatus, string> = {
  IN_PROGRESS: "EM PROGRESSO",
  FINALIZED: "FINALIZADA",
  DIVERGENT: "DIVERGENTE",
  VALIDATED: "VALIDADA",
};

export default function CommunicationDetailsPage() {
  const { isReady } = useAuthGuard();
  const params = useParams<{ id: string }>();
  const communicationId = params.id;
  const storedUser = getStoredUser();
  const currentUserId = storedUser.id ?? null;
  const currentUserRole = storedUser.role ?? null;

  const [summary, setSummary] = useState<CommunicationSummaryResponse | null>(null);
  const [cityImages, setCityImages] = useState<ProjectCityImage[]>([]);
  const [gazinImages, setGazinImages] = useState<ProjectGazinImage[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState("");
  const [widthM, setWidthM] = useState("");
  const [heightM, setHeightM] = useState("");
  const [cityImageId, setCityImageId] = useState("");
  const [gazinImageId, setGazinImageId] = useState("");
  const [cityImageZoom, setCityImageZoom] = useState(DEFAULT_IMAGE_ZOOM);
  const [cityImageOffsetX, setCityImageOffsetX] = useState(DEFAULT_IMAGE_OFFSET);
  const [cityImageOffsetY, setCityImageOffsetY] = useState(DEFAULT_IMAGE_OFFSET);
  const [gazinImageZoom, setGazinImageZoom] = useState(DEFAULT_IMAGE_ZOOM);
  const [gazinImageOffsetX, setGazinImageOffsetX] = useState(DEFAULT_IMAGE_OFFSET);
  const [gazinImageOffsetY, setGazinImageOffsetY] = useState(DEFAULT_IMAGE_OFFSET);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [editorMessage, setEditorMessage] = useState("");
  const [downloadState, setDownloadState] = useState<string | null>(null);
  const [isFrameEditorOpen, setIsFrameEditorOpen] = useState(false);
  const [isWallFormOpen, setIsWallFormOpen] = useState(false);
  const [isFrameFormOpen, setIsFrameFormOpen] = useState(false);
  const [isDivergenceFormOpen, setIsDivergenceFormOpen] = useState(false);
  const [newWallName, setNewWallName] = useState("");
  const [newFrameWallId, setNewFrameWallId] = useState("");
  const [newFrameName, setNewFrameName] = useState("");
  const [newFrameWidthM, setNewFrameWidthM] = useState("");
  const [newFrameHeightM, setNewFrameHeightM] = useState("");
  const [divergenceComment, setDivergenceComment] = useState("");
  const [wallFormError, setWallFormError] = useState("");
  const [frameFormError, setFrameFormError] = useState("");
  const [divergenceError, setDivergenceError] = useState("");
  const [modal, setModal] = useState<PageModalState | null>(null);
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgressState | null>(null);

  const loadCommunication = useCallback(async () => {
    if (!communicationId) return;
    setIsLoading(true);
    setPageError("");

    try {
      const [summaryResponse, cityImagesResponse, gazinImagesResponse] =
        await Promise.all([
          getCommunicationSummary(communicationId),
          listCommunicationCityImages(communicationId),
          listCommunicationGazinImages(communicationId),
        ]);

      setSummary(summaryResponse);
      setCityImages(cityImagesResponse);
      setGazinImages(gazinImagesResponse);
      const frames = summaryResponse.communication.walls.flatMap((wall) => wall.frames);
      const firstFrame = frames[0];
      setSelectedFrameId((current) =>
        current && frames.some((frame) => frame.id === current)
          ? current
          : firstFrame?.id || "",
      );
    } catch (error) {
      setPageError(
        getApiErrorMessage(
          error,
          "Não foi possível carregar os detalhes da comunicação visual.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [communicationId]);

  useEffect(() => subscribeToAppRefresh(() => void loadCommunication()), [loadCommunication]);
  useEffect(() => {
    if (isReady) void loadCommunication();
  }, [isReady, loadCommunication]);

  const selectedFrame = useMemo(() => {
    if (!summary || !selectedFrameId) return null;
    return (
      summary.communication.walls
        .flatMap((wall) => wall.frames)
        .find((frame) => frame.id === selectedFrameId) || null
    );
  }, [selectedFrameId, summary]);

  useEffect(() => {
    if (isFrameEditorOpen && !selectedFrame) {
      setIsFrameEditorOpen(false);
    }
  }, [isFrameEditorOpen, selectedFrame]);

  const previewCityImage = useMemo(() => {
    if (!selectedFrame) return null;
    return (
      cityImages.find((image) => image.id === cityImageId) ??
      selectedFrame.projectCityImage ??
      null
    );
  }, [cityImageId, cityImages, selectedFrame]);

  const previewGazinImage = useMemo(() => {
    if (!selectedFrame) return null;
    return (
      gazinImages.find((image) => image.id === gazinImageId) ??
      selectedFrame.projectGazinImage ??
      null
    );
  }, [gazinImageId, gazinImages, selectedFrame]);

  const previewCityCaption = useMemo(() => {
    if (!previewCityImage?.authorName) {
      return "FOTO DE AUTORIA DE: NOME DO FOTÓGRAFO";
    }

    return `FOTO DE AUTORIA DE: ${previewCityImage.authorName.toUpperCase()}`;
  }, [previewCityImage]);

  const previewGazinCaption = useMemo(() => {
    const description =
      previewGazinImage?.gazinLibraryImage.description ||
      previewGazinImage?.gazinLibraryImage.title;

    if (!description) {
      return "DESCRIÇÃO DA IMAGEM DA GAZIN";
    }

    return description.toUpperCase();
  }, [previewGazinImage]);

  const communicationStatus = summary?.communication.status ?? null;
  const canFinalizeFromStatus =
    communicationStatus === "IN_PROGRESS" || communicationStatus === "DIVERGENT";
  const canCurrentUserFinalize =
    Boolean(summary) &&
    (currentUserRole === "ADMIN" ||
      summary?.communication.createdBy?.id === currentUserId);
  const canShowFinalizeAction = canCurrentUserFinalize && canFinalizeFromStatus;
  const canAdminReviewAction =
    currentUserRole === "ADMIN" && communicationStatus === "FINALIZED";
  const finalizeReadinessMessages = useMemo(() => {
    if (!summary) {
      return [];
    }

    const messages: string[] = [];

    if (summary.readiness.missingCityImages > 0) {
      messages.push(
        `Faltam ${summary.readiness.missingCityImages} imagem(ns) da cidade para finalizar esta comunicacao.`,
      );
    }

    if (summary.readiness.missingGazinImages > 0) {
      messages.push(
        `Faltam ${summary.readiness.missingGazinImages} imagem(ns) da Gazin para finalizar esta comunicacao.`,
      );
    }

    return messages;
  }, [summary]);
  const finalizeActionLabel =
    communicationStatus === "DIVERGENT"
      ? "Finalizar novamente"
      : "Finalizar comunicacao";
  const finalizeButtonTitle =
    finalizeReadinessMessages.length > 0
      ? finalizeReadinessMessages.join(" ")
      : "Finalizar esta comunicacao";
  const downloadPercent = downloadProgress?.percent ?? 0;
  const downloadRemainingPercent = Math.max(0, 100 - downloadPercent);
  const downloadProgressMeta =
    downloadProgress?.metaLabel ??
    (downloadProgress?.totalBytes
      ? `${formatFileSize(downloadProgress.loadedBytes)} de ${formatFileSize(downloadProgress.totalBytes)} baixados`
      : downloadProgress?.loadedBytes
        ? `${formatFileSize(downloadProgress.loadedBytes)} baixados`
        : "Preparando o arquivo para download...");
  const divergenceCommentCount = divergenceComment.length;
  const validatedSummary = summary?.communication.validatedAt
    ? `Validada em ${formatDateTime(summary.communication.validatedAt)}${
        summary.communication.validatedBy?.name
          ? ` por ${summary.communication.validatedBy.name}`
          : ""
      }.`
    : "Esta comunicacao ja foi validada.";

  const pageActions = summary ? (
    <>
      {canAdminReviewAction ? (
        <>
          <button
            className="btn btn-secondary btn-with-icon"
            type="button"
            onClick={handleOpenDivergenceForm}
            disabled={isLoading || isSaving || Boolean(downloadState)}
          >
            <NoticeIcon />
            <span>Marcar divergente</span>
          </button>
          <button
            className="btn btn-primary btn-with-icon"
            type="button"
            onClick={() =>
              setModal({
                title: "Validar comunicacao?",
                description:
                  "Depois desta confirmacao, a comunicacao passara de finalizada para validada.",
                variant: "success",
                confirmLabel: "Validar comunicacao",
                onConfirm: handleValidateCommunication,
              })
            }
            disabled={isLoading || isSaving || Boolean(downloadState)}
          >
            <StatusToggleIcon />
            <span>{isSaving ? "Salvando..." : "Validar comunicacao"}</span>
          </button>
        </>
      ) : null}
      {canShowFinalizeAction ? (
        <button
          className="btn btn-primary btn-with-icon"
          type="button"
          onClick={() =>
            setModal({
              title: "Finalizar comunicacao?",
              description:
                communicationStatus === "DIVERGENT"
                  ? "Depois desta confirmacao, a comunicacao voltara para o fluxo de finalizacao."
                  : "Depois desta confirmacao, a comunicacao saira de em progresso e passara para finalizada.",
              variant: "info",
              confirmLabel: finalizeActionLabel,
              onConfirm: handleFinalizeCommunication,
            })
          }
          disabled={
            isLoading ||
            isSaving ||
            Boolean(downloadState) ||
            finalizeReadinessMessages.length > 0
          }
          title={finalizeButtonTitle}
        >
          <StatusToggleIcon />
          <span>{isSaving ? "Salvando..." : finalizeActionLabel}</span>
        </button>
      ) : null}
      <button
        className="btn btn-secondary btn-with-icon"
        type="button"
        onClick={() => void handleCommunicationDownload("jpg")}
        disabled={isLoading || isSaving || Boolean(downloadState)}
      >
        <DownloadIcon />
        <span>
          {downloadState === "communication:jpg"
            ? "Baixando..."
            : "Todos em JPG (ZIP)"}
        </span>
      </button>
      <button
        className="btn btn-primary btn-with-icon"
        type="button"
        onClick={() => void handleCommunicationDownload("pdf")}
        disabled={isLoading || isSaving || Boolean(downloadState)}
      >
        <DownloadIcon />
        <span>
          {downloadState === "communication:pdf"
            ? "Baixando..."
            : "Todos em PDF (ZIP)"}
        </span>
      </button>
    </>
  ) : null;

  useEffect(() => {
    if (!selectedFrame) return;
    setWidthM(String(selectedFrame.widthM));
    setHeightM(String(selectedFrame.heightM));
    setCityImageId(selectedFrame.projectCityImageId || "");
    setGazinImageId(selectedFrame.projectGazinImageId || "");
    setCityImageZoom(clampImageZoom(Number(selectedFrame.cityImageZoom)));
    setCityImageOffsetX(clampImageOffset(Number(selectedFrame.cityImageOffsetX)));
    setCityImageOffsetY(clampImageOffset(Number(selectedFrame.cityImageOffsetY)));
    setGazinImageZoom(clampImageZoom(Number(selectedFrame.gazinImageZoom)));
    setGazinImageOffsetX(clampImageOffset(Number(selectedFrame.gazinImageOffsetX)));
    setGazinImageOffsetY(clampImageOffset(Number(selectedFrame.gazinImageOffsetY)));
    setEditorMessage("");
  }, [selectedFrame]);

  function getNextWallNumber() {
    return (
      Math.max(
        0,
        ...(summary?.communication.walls.map((wall) => Number(wall.order) || 0) ?? []),
      ) + 1
    );
  }

  function getNextFrameNumber(wallId: string) {
    const wall = summary?.communication.walls.find((item) => item.id === wallId);
    return (
      Math.max(
        0,
        ...(wall?.frames.map((frame) => Number(frame.order) || 0) ?? []),
      ) + 1
    );
  }

  function handleOpenFrameEditor(frameId: string) {
    setSelectedFrameId(frameId);
    setEditorMessage("");
    setIsFrameEditorOpen(true);
  }

  function handleCloseFrameEditor() {
    setIsFrameEditorOpen(false);
    setEditorMessage("");
  }

  function handleOpenWallForm() {
    setNewWallName(`Parede ${getNextWallNumber()}`);
    setWallFormError("");
    setIsWallFormOpen(true);
  }

  function handleCloseWallForm() {
    setIsWallFormOpen(false);
    setNewWallName("");
    setWallFormError("");
  }

  function handleOpenFrameForm(wallId: string) {
    setNewFrameWallId(wallId);
    setNewFrameName(`Quadro ${getNextFrameNumber(wallId)}`);
    setNewFrameWidthM("");
    setNewFrameHeightM("");
    setFrameFormError("");
    setIsFrameFormOpen(true);
  }

  function handleCloseFrameForm() {
    setIsFrameFormOpen(false);
    setNewFrameWallId("");
    setNewFrameName("");
    setNewFrameWidthM("");
    setNewFrameHeightM("");
    setFrameFormError("");
  }

  function handleOpenDivergenceForm() {
    setDivergenceComment(summary?.communication.divergenceComment ?? "");
    setDivergenceError("");
    setIsDivergenceFormOpen(true);
  }

  function handleCloseDivergenceForm() {
    setIsDivergenceFormOpen(false);
    setDivergenceComment("");
    setDivergenceError("");
  }

  function openDownloadProgress(title: string, description: string) {
    setDownloadProgress({
      title,
      description,
      percent: 0,
      loadedBytes: 0,
      totalBytes: null,
      metaLabel: undefined,
    });
  }

  function handleDownloadProgress(
    title: string,
    description: string,
    progress: DownloadProgressInfo,
  ) {
    setDownloadProgress({
      title,
      description,
      percent: Math.min(Math.max(progress.percent, 0), 100),
      loadedBytes: progress.loadedBytes,
      totalBytes: progress.totalBytes,
      metaLabel: undefined,
    });
  }

  async function finishDownloadProgress() {
    setDownloadProgress((current) =>
      current
        ? {
            ...current,
            percent: 100,
          }
        : current,
    );

    await new Promise((resolve) => window.setTimeout(resolve, 180));
    setDownloadProgress(null);
  }

  async function waitForExportJob(
    jobId: string,
    format: "jpg" | "pdf",
    totalFramesHint: number,
  ) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 1000 * 60 * 15) {
      const job = await getExportJob(jobId);

      if (job.status === "failed") {
        throw new Error(
          job.errorMessage || "Não foi possível gerar o arquivo para download.",
        );
      }

      if (job.status === "completed") {
        return job;
      }

      const totalFrames = Math.max(job.totalFrames || totalFramesHint || 0, 1);
      const completedFrames = Math.min(job.completedFrames || 0, totalFrames);

      setDownloadProgress({
        title:
          format === "jpg" ? "Gerando ZIP dos JPGs" : "Gerando ZIP dos PDFs",
        description: job.currentFrameName
          ? `Gerando ${job.currentFrameName} (${completedFrames}/${totalFrames})`
          : `Gerando ${completedFrames} de ${totalFrames} quadro(s)`,
        percent: Math.round((completedFrames / totalFrames) * 100),
        loadedBytes: completedFrames,
        totalBytes: totalFrames,
        metaLabel: `${completedFrames} de ${totalFrames} quadro(s) gerado(s)`,
      });

      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }

    throw new Error("A geração do arquivo demorou mais do que o esperado.");
  }

  async function handleCreateWall() {
    if (!communicationId) return;

    const name = newWallName.trim();

    if (!name) {
      setWallFormError("Informe o nome da parede.");
      return;
    }

    setIsSaving(true);
    setWallFormError("");

    try {
      await addCommunicationWall(communicationId, { name });
      await loadCommunication();
      handleCloseWallForm();
    } catch (error) {
      setWallFormError(
        getApiErrorMessage(error, "Nao foi possivel adicionar a parede."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateFrame() {
    if (!newFrameWallId) return;

    const widthM = parsePositive(newFrameWidthM);
    const heightM = parsePositive(newFrameHeightM);

    if (!widthM || !heightM) {
      setFrameFormError("Informe largura e altura validas para o quadro.");
      return;
    }

    setIsSaving(true);
    setFrameFormError("");

    try {
      const createdFrame = await addCommunicationFrame(newFrameWallId, {
        name: newFrameName.trim() || undefined,
        widthM,
        heightM,
      });
      await loadCommunication();
      setSelectedFrameId(createdFrame.id);
      setIsFrameEditorOpen(true);
      handleCloseFrameForm();
    } catch (error) {
      setFrameFormError(
        getApiErrorMessage(error, "Nao foi possivel adicionar o quadro."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRedistribute() {
    if (!communicationId) return;
    setIsSaving(true);

    try {
      await assignCommunicationImages(communicationId);
      await loadCommunication();
      setEditorMessage("Quadros redistribuídos automaticamente com sucesso.");
    } catch (error) {
      setModal({
        title: "Não foi possível redistribuir os quadros",
        description:
          error instanceof Error
            ? error.message
            : getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCommunicationDownload(format: "jpg" | "pdf") {
    if (!communicationId) return;
    const nextState = `communication:${format}`;
    const title =
      format === "jpg" ? "Baixando todos os JPGs" : "Baixando todos os PDFs";
    const description =
      format === "jpg"
        ? "Aguarde o arquivo ZIP com todos os JPGs chegar a 100%."
        : "Aguarde o arquivo ZIP com todos os PDFs chegar a 100%.";
    setDownloadState(nextState);
    setDownloadProgress({
      title:
        format === "jpg" ? "Gerando ZIP dos JPGs" : "Gerando ZIP dos PDFs",
      description: "Preparando os quadros para exportação...",
      percent: 0,
      loadedBytes: 0,
      totalBytes: summary?.communication.totalFrames ?? null,
      metaLabel: summary?.communication.totalFrames
        ? `0 de ${summary.communication.totalFrames} quadro(s) gerado(s)`
        : "Preparando os quadros para exportacao...",
    });

    try {
      const createdJob =
        format === "jpg"
          ? await createCommunicationJpgZipJob(communicationId)
          : await createCommunicationPdfZipJob(communicationId);
      const completedJob = await waitForExportJob(
        createdJob.id,
        format,
        createdJob.totalFrames,
      );

      openDownloadProgress(title, description);
      await downloadExportJob(completedJob.id, completedJob.fileName, {
        onProgress: (progress) =>
          handleDownloadProgress(title, description, progress),
      });
      await finishDownloadProgress();
    } catch (error) {
      setDownloadProgress(null);
      setModal({
        title:
          format === "jpg"
            ? "Não foi possível baixar os JPGs"
            : "Não foi possível baixar o PDF",
        description: getApiErrorMessage(
          error,
          "Tente novamente em alguns instantes.",
        ),
      });
    } finally {
      setDownloadState((current) => (current === nextState ? null : current));
    }
  }

  async function handleFrameDownload(frameId: string, format: "jpg" | "pdf") {
    const nextState = `frame:${frameId}:${format}`;
    const frameName =
      summary?.communication.walls
        .flatMap((wall) => wall.frames)
        .find((frame) => frame.id === frameId)?.name || "quadro";
    const title =
      format === "jpg"
        ? `Baixando JPG de ${frameName}`
        : `Baixando PDF de ${frameName}`;
    const description =
      format === "jpg"
        ? "Aguarde o JPG do quadro chegar a 100%."
        : "Aguarde o PDF do quadro chegar a 100%.";
    setDownloadState(nextState);
    openDownloadProgress(title, description);

    try {
      if (format === "jpg") {
        await downloadFrameJpg(frameId, {
          onProgress: (progress) =>
            handleDownloadProgress(title, description, progress),
        });
      } else {
        await downloadFramePdf(frameId, {
          onProgress: (progress) =>
            handleDownloadProgress(title, description, progress),
        });
      }
      await finishDownloadProgress();
    } catch (error) {
      setDownloadProgress(null);
      setModal({
        title:
          format === "jpg"
            ? "Não foi possível baixar o JPG do quadro"
            : "Não foi possível baixar o PDF do quadro",
        description: getApiErrorMessage(
          error,
          "Tente novamente em alguns instantes.",
        ),
      });
    } finally {
      setDownloadState((current) => (current === nextState ? null : current));
    }
  }

  async function handleSaveFrame() {
    if (!selectedFrame) return;

    const parsedWidth = Number(String(widthM).replace(",", "."));
    const parsedHeight = Number(String(heightM).replace(",", "."));

    if (
      !cityImageId ||
      !gazinImageId ||
      Number.isNaN(parsedWidth) ||
      parsedWidth <= 0 ||
      Number.isNaN(parsedHeight) ||
      parsedHeight <= 0
    ) {
      setModal({
        title: "Complete os dados do quadro",
        description:
          "Selecione as duas imagens e informe medidas válidas para salvar.",
      });
      return;
    }

    setIsSaving(true);

    try {
      if (cityImageId !== selectedFrame.projectCityImageId) {
        await swapFrameCityImage(selectedFrame.id, cityImageId);
      }

      if (gazinImageId !== selectedFrame.projectGazinImageId) {
        await swapFrameGazinImage(selectedFrame.id, gazinImageId);
      }

      if (
        String(selectedFrame.widthM) !== String(widthM) ||
        String(selectedFrame.heightM) !== String(heightM)
      ) {
        await updateFrameDimensions(selectedFrame.id, parsedWidth, parsedHeight);
      }

      if (
        Number(selectedFrame.cityImageZoom) !== cityImageZoom ||
        Number(selectedFrame.cityImageOffsetX) !== cityImageOffsetX ||
        Number(selectedFrame.cityImageOffsetY) !== cityImageOffsetY ||
        Number(selectedFrame.gazinImageZoom) !== gazinImageZoom ||
        Number(selectedFrame.gazinImageOffsetX) !== gazinImageOffsetX ||
        Number(selectedFrame.gazinImageOffsetY) !== gazinImageOffsetY
      ) {
        await updateFrameImageLayout(selectedFrame.id, {
          cityImageZoom,
          cityImageOffsetX,
          cityImageOffsetY,
          gazinImageZoom,
          gazinImageOffsetX,
          gazinImageOffsetY,
        });
      }

      await loadCommunication();
      setEditorMessage("Quadro atualizado com sucesso.");
    } catch (error) {
      setModal({
        title: "Não foi possível salvar o quadro",
        description: getApiErrorMessage(
          error,
          "Tente novamente em alguns instantes.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteFrame(frameId: string) {
    setIsSaving(true);

    try {
      await deleteFrame(frameId);
      await loadCommunication();
      if (selectedFrameId === frameId) {
        handleCloseFrameEditor();
      }
    } catch (error) {
      setModal({
        title: "Nao foi possivel excluir o quadro",
        description: getApiErrorMessage(
          error,
          "Tente novamente em alguns instantes.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteWall(wallId: string) {
    const removedWallHasSelectedFrame =
      summary?.communication.walls
        .find((wall) => wall.id === wallId)
        ?.frames.some((frame) => frame.id === selectedFrameId) ?? false;

    setIsSaving(true);

    try {
      await deleteCommunicationWall(wallId);
      await loadCommunication();
      if (removedWallHasSelectedFrame) {
        handleCloseFrameEditor();
      }
    } catch (error) {
      setModal({
        title: "Nao foi possivel excluir a parede",
        description: getApiErrorMessage(
          error,
          "Tente novamente em alguns instantes.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFinalizeCommunication() {
    if (!communicationId) return;

    setIsSaving(true);

    try {
      const updated = await finalizeCommunication(communicationId);
      triggerAppRefresh();
      await loadCommunication();
      setModal({
        title:
          updated.status === "VALIDATED"
            ? "Comunicacao finalizada e validada"
            : "Comunicacao finalizada",
        description:
          updated.status === "VALIDATED"
            ? "Como esta comunicacao foi finalizada por um Admin criador, ela ja ficou validada."
            : "A comunicacao foi finalizada com sucesso e agora aguarda a validacao do Admin.",
        variant: "success",
      });
    } catch (error) {
      setModal({
        title: "Nao foi possivel finalizar a comunicacao",
        description: getApiErrorMessage(
          error,
          "Tente novamente em alguns instantes.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleValidateCommunication() {
    if (!communicationId) return;

    setIsSaving(true);

    try {
      await validateCommunication(communicationId);
      triggerAppRefresh();
      await loadCommunication();
      setModal({
        title: "Comunicacao validada",
        description:
          "A comunicacao foi validada com sucesso e agora esta pronta para uso.",
        variant: "success",
      });
    } catch (error) {
      setModal({
        title: "Nao foi possivel validar a comunicacao",
        description: getApiErrorMessage(
          error,
          "Tente novamente em alguns instantes.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmitDivergence() {
    if (!communicationId) return;

    const comment = divergenceComment.trim();

    if (!comment) {
      setDivergenceError(
        "Escreva um comentario explicando o que precisa ser corrigido.",
      );
      return;
    }

    setIsSaving(true);
    setDivergenceError("");

    try {
      await divergeCommunication(communicationId, comment);
      triggerAppRefresh();
      await loadCommunication();
      handleCloseDivergenceForm();
      setModal({
        title: "Comunicacao marcada como divergente",
        description:
          "O comentario do Admin foi salvo e a comunicacao voltou para ajuste.",
        variant: "success",
      });
    } catch (error) {
      setDivergenceError(
        getApiErrorMessage(
          error,
          "Nao foi possivel marcar a comunicacao como divergente.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!isReady) return null;

  return (
    <AppLayout>
      <PageTitleCard
        page={communicationDetailsPage}
        description={
          summary?.communication.fullName ||
          "Revise os quadros, as imagens e as medidas desta comunicação visual."
        }
        actions={pageActions}
      />

      <section className="communication-details-grid">
        <div className="panel panel-large">
          <div className="panel-header panel-header-inline">
            <div>
              <h3>Quadros por parede</h3>
              <p>Revise a distribuição e escolha um quadro para editar.</p>
            </div>
            <div className="panel-header-actions">
              <button
                className="btn btn-primary btn-with-icon"
                type="button"
                onClick={handleOpenWallForm}
                disabled={isLoading || isSaving || Boolean(downloadState)}
              >
                <PlusIcon />
                Nova parede
              </button>
              <button
                className="btn btn-secondary btn-with-icon"
                type="button"
                onClick={() =>
                  setModal({
                    title: "Redistribuir quadros?",
                    description:
                      "O sistema vai reorganizar todas as imagens automaticamente com base na ordem atual.",
                    onConfirm: handleRedistribute,
                  })
                }
                disabled={isLoading || isSaving || Boolean(downloadState)}
              >
                <StatusToggleIcon />
                Redistribuir
              </button>
            </div>
          </div>

          {pageError ? (
            <div className="communication-panel-body">
              <div className="inline-feedback error">{pageError}</div>
            </div>
          ) : null}
          {isLoading ? (
            <div className="empty-state">
              <span>Carregando comunicação...</span>
            </div>
          ) : null}

          {!isLoading && summary ? (
            <div className="communication-walls-stack">
              <div className="communication-review-grid is-summary">
                <article className="communication-review-card is-compact">
                  <span>Status</span>
                  <strong className="communication-review-card-status">
                    {communicationStatusLabelMap[summary.communication.status]}
                  </strong>
                </article>
                <article className="communication-review-card is-compact">
                  <span>Quadros</span>
                  <strong>{summary.stats.totalFrames}</strong>
                </article>
                <article className="communication-review-card is-compact">
                  <span>Fotos da cidade</span>
                  <strong>{summary.readiness.totalCityImages}</strong>
                </article>
                <article className="communication-review-card is-compact">
                  <span>Imagens Gazin</span>
                  <strong>{summary.readiness.totalProjectGazinImages}</strong>
                </article>
              </div>

              {communicationStatus === "FINALIZED" ? (
                <div className="inline-feedback">
                  {canAdminReviewAction
                    ? "Esta comunicacao ja foi finalizada e aguarda sua validacao como Admin."
                    : "Esta comunicacao ja foi finalizada e aguarda validacao do Admin."}
                </div>
              ) : communicationStatus === "VALIDATED" ? (
                <div className="inline-feedback success">
                  {validatedSummary}
                </div>
              ) : communicationStatus === "DIVERGENT" ? (
                <div className="inline-feedback error">
                  {summary.communication.divergenceComment
                    ? `Comentario do Admin: ${summary.communication.divergenceComment}`
                    : "Esta comunicacao foi marcada como divergente e precisa de ajustes."}
                </div>
              ) : finalizeReadinessMessages.length > 0 ? (
                <div className="inline-feedback error">
                  {finalizeReadinessMessages.join(" ")}
                </div>
              ) : canShowFinalizeAction ? (
                <div className="inline-feedback success">
                  Esta comunicacao esta pronta para finalizacao.
                </div>
              ) : null}

              {communicationStatus === "DIVERGENT" &&
              finalizeReadinessMessages.length === 0 &&
              canShowFinalizeAction ? (
                <div className="inline-feedback success">
                  Depois de revisar os ajustes, voce ja pode finalizar novamente.
                </div>
              ) : null}

              {summary.communication.walls.map((wall) => (
                <article key={wall.id} className="communication-wall-preview">
                  <div className="communication-wall-preview-header">
                    <div className="communication-wall-preview-copy">
                      <strong>{wall.name}</strong>
                      <span>{wall.frames.length} quadro(s)</span>
                    </div>
                    <div className="communication-wall-preview-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-with-icon"
                        onClick={() => handleOpenFrameForm(wall.id)}
                        disabled={isSaving || Boolean(downloadState) || isLoading}
                      >
                        <PlusIcon />
                        Novo quadro
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-with-icon"
                        onClick={() =>
                          setModal({
                            title: `Excluir ${wall.name}?`,
                            description:
                              "Todos os quadros desta parede serao removidos e as imagens voltarao para o acervo desta comunicacao.",
                            variant: "danger",
                            confirmLabel: "Excluir parede",
                            confirmTone: "danger",
                            onConfirm: () => {
                              void handleDeleteWall(wall.id);
                            },
                          })
                        }
                        disabled={isSaving || Boolean(downloadState) || isLoading}
                      >
                        <TrashIcon />
                        <span>Excluir parede</span>
                      </button>
                    </div>
                  </div>
                  {wall.frames.length ? (
                    <div className="communication-frame-preview-grid">
                      {wall.frames.map((frame) => {
                      const canDownload =
                        Boolean(frame.projectCityImage) &&
                        Boolean(frame.projectGazinImage);

                      return (
                        <article
                          key={frame.id}
                          className={`communication-frame-preview-card ${
                            selectedFrameId === frame.id ? "is-selected" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="communication-frame-preview-select"
                            onClick={() => setSelectedFrameId(frame.id)}
                          >
                            <div className="communication-frame-preview-images">
                              <div className="communication-frame-preview-media">
                                {frame.projectCityImage ? (
                                  <img
                                    src={buildImageSource(frame.projectCityImage.imageUrl)}
                                    alt={frame.name}
                                  />
                                ) : (
                                  <span>Sem foto</span>
                                )}
                              </div>
                              <div className="communication-frame-preview-media">
                                {frame.projectGazinImage ? (
                                  <img
                                    src={buildImageSource(
                                      frame.projectGazinImage.gazinLibraryImage.imageUrl,
                                    )}
                                    alt={frame.projectGazinImage.gazinLibraryImage.title}
                                  />
                                ) : (
                                  <span>Sem Gazin</span>
                                )}
                              </div>
                            </div>
                            <div className="communication-frame-preview-copy">
                              <strong>{frame.name}</strong>
                              <span>
                                {measureLabel(frame.widthM)} × {measureLabel(frame.heightM)}
                              </span>
                            </div>
                          </button>

                          <div className="communication-frame-preview-actions">
                            <button
                              type="button"
                              className="communication-frame-action-button"
                              onClick={() => handleOpenFrameEditor(frame.id)}
                              disabled={isSaving || Boolean(downloadState) || isLoading}
                            >
                              <EditIcon />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              className="communication-frame-action-button is-danger"
                              onClick={() =>
                                setModal({
                                  title: `Excluir ${frame.name}?`,
                                  description:
                                    "As imagens vinculadas a este quadro voltarao para o acervo da comunicacao.",
                                  variant: "danger",
                                  confirmLabel: "Excluir quadro",
                                  confirmTone: "danger",
                                  onConfirm: () => {
                                    void handleDeleteFrame(frame.id);
                                  },
                                })
                              }
                              disabled={isSaving || Boolean(downloadState) || isLoading}
                            >
                              <TrashIcon />
                              <span>Excluir</span>
                            </button>
                            <button
                              type="button"
                              className="communication-frame-action-button"
                              onClick={() => void handleFrameDownload(frame.id, "jpg")}
                              disabled={
                                !canDownload ||
                                isSaving ||
                                Boolean(downloadState) ||
                                isLoading
                              }
                              title={
                                canDownload
                                  ? "Baixar quadro em JPG"
                                  : "Este quadro ainda precisa das duas imagens"
                              }
                            >
                              <DownloadIcon />
                              <span>
                                {downloadState === `frame:${frame.id}:jpg`
                                  ? "Baixando..."
                                  : "JPG"}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="communication-frame-action-button"
                              onClick={() => void handleFrameDownload(frame.id, "pdf")}
                              disabled={
                                !canDownload ||
                                isSaving ||
                                Boolean(downloadState) ||
                                isLoading
                              }
                              title={
                                canDownload
                                  ? "Baixar quadro em PDF"
                                  : "Este quadro ainda precisa das duas imagens"
                              }
                            >
                              <DownloadIcon />
                              <span>
                                {downloadState === `frame:${frame.id}:pdf`
                                  ? "Baixando..."
                                  : "PDF"}
                              </span>
                            </button>
                          </div>
                        </article>
                      );
                      })}
                    </div>
                  ) : (
                    <div className="communication-wall-empty">
                      Nenhum quadro cadastrado nesta parede ainda.
                    </div>
                  )}
                </article>
              ))}

              {!summary.communication.walls.length ? (
                <div className="empty-state">
                  <span>Nenhuma parede cadastrada nesta comunicacao.</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <AppModal
          open={isWallFormOpen}
          title="Nova parede"
          description="Cadastre uma nova parede nesta comunicacao para incluir outros quadros depois."
          variant="info"
          icon={<PlusIcon />}
          onClose={handleCloseWallForm}
          secondaryAction={{
            label: "Cancelar",
            onClick: handleCloseWallForm,
            disabled: isSaving,
          }}
          primaryAction={{
            label: isSaving ? "Salvando..." : "Adicionar parede",
            onClick: () => void handleCreateWall(),
            disabled: isSaving,
            icon: <PlusIcon />,
          }}
        >
          <div className="communications-step-stack">
            <label className="field-stack">
              <span>Nome da parede</span>
              <input
                value={newWallName}
                onChange={(event) => setNewWallName(event.target.value)}
                placeholder="Parede 1"
              />
            </label>

            {wallFormError ? (
              <div className="inline-feedback error">{wallFormError}</div>
            ) : null}
          </div>
        </AppModal>

        <AppModal
          open={isFrameFormOpen}
          title="Novo quadro"
          description="Informe as medidas do novo quadro para incluir nesta parede."
          variant="info"
          icon={<PlusIcon />}
          onClose={handleCloseFrameForm}
          secondaryAction={{
            label: "Cancelar",
            onClick: handleCloseFrameForm,
            disabled: isSaving,
          }}
          primaryAction={{
            label: isSaving ? "Salvando..." : "Adicionar quadro",
            onClick: () => void handleCreateFrame(),
            disabled: isSaving,
            icon: <PlusIcon />,
          }}
        >
          <div className="communications-step-stack">
            <label className="field-stack">
              <span>Nome do quadro</span>
              <input
                value={newFrameName}
                onChange={(event) => setNewFrameName(event.target.value)}
                placeholder="Quadro 1"
              />
            </label>

            <div className="communications-step-grid">
              <label className="field-stack">
                <span>Largura (m)</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={newFrameWidthM}
                  onChange={(event) => setNewFrameWidthM(event.target.value)}
                />
              </label>
              <label className="field-stack">
                <span>Altura (m)</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={newFrameHeightM}
                  onChange={(event) => setNewFrameHeightM(event.target.value)}
                />
              </label>
            </div>

            {frameFormError ? (
              <div className="inline-feedback error">{frameFormError}</div>
            ) : null}
          </div>
        </AppModal>

        <AppModal
          open={isDivergenceFormOpen}
          title="Marcar comunicacao como divergente"
          description="Explique o que o time precisa corrigir antes de uma nova finalizacao."
          variant="warning"
          icon={<NoticeIcon />}
          onClose={handleCloseDivergenceForm}
          secondaryAction={{
            label: "Cancelar",
            onClick: handleCloseDivergenceForm,
            disabled: isSaving,
          }}
          primaryAction={{
            label: isSaving ? "Salvando..." : "Salvar comentario e divergir",
            onClick: () => void handleSubmitDivergence(),
            tone: "danger",
            disabled: isSaving,
            icon: <NoticeIcon />,
          }}
        >
          <div className="communications-step-stack">
            <label className="field-stack">
              <span>Comentario do Admin</span>
              <textarea
                value={divergenceComment}
                onChange={(event) => setDivergenceComment(event.target.value)}
                rows={5}
                maxLength={1000}
                placeholder="Descreva o que esta errado ou o que precisa ser ajustado."
              />
            </label>

            <div className="inline-feedback">
              {divergenceCommentCount}/1000 caracteres
            </div>

            {divergenceError ? (
              <div className="inline-feedback error">{divergenceError}</div>
            ) : null}
          </div>
        </AppModal>

        <AppModal
          open={isFrameEditorOpen && Boolean(selectedFrame)}
          title={selectedFrame ? `Editar ${selectedFrame.name}` : "Editor do quadro"}
          description="Troque imagens, ajuste medidas e confira a moldura final."
        variant="info"
        icon={<EditIcon />}
        size="xlarge"
        onClose={handleCloseFrameEditor}
        secondaryAction={{
          label: "Fechar",
          onClick: handleCloseFrameEditor,
          disabled: isSaving,
        }}
      >
        <div className="panel">
          <div className="panel-header panel-header-inline">
            <div>
              <h3>{selectedFrame ? `Editar ${selectedFrame.name}` : "Editor do quadro"}</h3>
              <p>Troque imagens, ajuste medidas e confira a moldura final.</p>
            </div>
            {selectedFrame ? (
              <div className="panel-header-actions">
                <button
                  className="btn btn-secondary btn-with-icon"
                  type="button"
                  onClick={() => void handleFrameDownload(selectedFrame.id, "jpg")}
                  disabled={
                    !selectedFrame.projectCityImage ||
                    !selectedFrame.projectGazinImage ||
                    isSaving ||
                    Boolean(downloadState)
                  }
                >
                  <DownloadIcon />
                  <span>
                    {downloadState === `frame:${selectedFrame.id}:jpg`
                      ? "Baixando..."
                      : "JPG"}
                  </span>
                </button>
                <button
                  className="btn btn-secondary btn-with-icon"
                  type="button"
                  onClick={() => void handleFrameDownload(selectedFrame.id, "pdf")}
                  disabled={
                    !selectedFrame.projectCityImage ||
                    !selectedFrame.projectGazinImage ||
                    isSaving ||
                    Boolean(downloadState)
                  }
                >
                  <DownloadIcon />
                  <span>
                    {downloadState === `frame:${selectedFrame.id}:pdf`
                      ? "Baixando..."
                      : "PDF"}
                  </span>
                </button>
              </div>
            ) : null}
          </div>

          {selectedFrame ? (
            <div className="communications-step-stack">
              <CommunicationExportPreview
                cityImageSrc={buildImageSource(previewCityImage?.imageUrl)}
                gazinImageSrc={buildImageSource(
                  previewGazinImage?.gazinLibraryImage.imageUrl,
                )}
                cityCaption={previewCityCaption}
                gazinCaption={previewGazinCaption}
                cityFallback="Sem imagem da cidade"
                gazinFallback="Sem imagem da Gazin"
                aspectRatio={Number(selectedFrame.widthM) / Number(selectedFrame.heightM)}
                cityTransform={{
                  zoom: cityImageZoom,
                  offsetX: cityImageOffsetX,
                  offsetY: cityImageOffsetY,
                }}
                gazinTransform={{
                  zoom: gazinImageZoom,
                  offsetX: gazinImageOffsetX,
                  offsetY: gazinImageOffsetY,
                }}
              />

              <label className="field-stack">
                <span>Imagem da cidade</span>
                <select
                  className="app-select"
                  value={cityImageId}
                  onChange={(event) => setCityImageId(event.target.value)}
                >
                  {cityImages.map((image) => (
                    <option key={image.id} value={image.id}>
                      {image.fileName || image.authorName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack">
                <span>Imagem da Gazin</span>
                <select
                  className="app-select"
                  value={gazinImageId}
                  onChange={(event) => setGazinImageId(event.target.value)}
                >
                  {gazinImages.map((image) => (
                    <option key={image.id} value={image.id}>
                      {image.gazinLibraryImage.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="communications-step-grid">
                <label className="field-stack">
                  <span>Largura (m)</span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={widthM}
                    onChange={(event) => setWidthM(event.target.value)}
                  />
                </label>
                <label className="field-stack">
                  <span>Altura (m)</span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={heightM}
                    onChange={(event) => setHeightM(event.target.value)}
                  />
                </label>
              </div>

              <div className="frame-adjustments-grid">
                <section className="frame-adjustment-card">
                  <div className="frame-adjustment-header">
                    <div>
                      <strong>Enquadramento da cidade</strong>
                      <span>Zoom e posição da foto da cidade dentro da moldura.</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setCityImageZoom(DEFAULT_IMAGE_ZOOM);
                        setCityImageOffsetX(DEFAULT_IMAGE_OFFSET);
                        setCityImageOffsetY(DEFAULT_IMAGE_OFFSET);
                      }}
                    >
                      Resetar
                    </button>
                  </div>

                  <label className="range-field">
                    <div className="range-field-header">
                      <span>Zoom</span>
                      <strong>{cityImageZoom.toFixed(2)}x</strong>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={cityImageZoom}
                      onChange={(event) =>
                        setCityImageZoom(clampImageZoom(Number(event.target.value)))
                      }
                    />
                  </label>

                  <label className="range-field">
                    <div className="range-field-header">
                      <span>Posição horizontal</span>
                      <strong>{cityImageOffsetX}%</strong>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={cityImageOffsetX}
                      onChange={(event) =>
                        setCityImageOffsetX(clampImageOffset(Number(event.target.value)))
                      }
                    />
                  </label>

                  <label className="range-field">
                    <div className="range-field-header">
                      <span>Posição vertical</span>
                      <strong>{cityImageOffsetY}%</strong>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={cityImageOffsetY}
                      onChange={(event) =>
                        setCityImageOffsetY(clampImageOffset(Number(event.target.value)))
                      }
                    />
                  </label>
                </section>

                <section className="frame-adjustment-card">
                  <div className="frame-adjustment-header">
                    <div>
                      <strong>Enquadramento da Gazin</strong>
                      <span>Zoom e posição da imagem institucional dentro da moldura.</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setGazinImageZoom(DEFAULT_IMAGE_ZOOM);
                        setGazinImageOffsetX(DEFAULT_IMAGE_OFFSET);
                        setGazinImageOffsetY(DEFAULT_IMAGE_OFFSET);
                      }}
                    >
                      Resetar
                    </button>
                  </div>

                  <label className="range-field">
                    <div className="range-field-header">
                      <span>Zoom</span>
                      <strong>{gazinImageZoom.toFixed(2)}x</strong>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={gazinImageZoom}
                      onChange={(event) =>
                        setGazinImageZoom(clampImageZoom(Number(event.target.value)))
                      }
                    />
                  </label>

                  <label className="range-field">
                    <div className="range-field-header">
                      <span>Posição horizontal</span>
                      <strong>{gazinImageOffsetX}%</strong>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={gazinImageOffsetX}
                      onChange={(event) =>
                        setGazinImageOffsetX(clampImageOffset(Number(event.target.value)))
                      }
                    />
                  </label>

                  <label className="range-field">
                    <div className="range-field-header">
                      <span>Posição vertical</span>
                      <strong>{gazinImageOffsetY}%</strong>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={gazinImageOffsetY}
                      onChange={(event) =>
                        setGazinImageOffsetY(clampImageOffset(Number(event.target.value)))
                      }
                    />
                  </label>
                </section>
              </div>

              {editorMessage ? (
                <div className="inline-feedback success">{editorMessage}</div>
              ) : null}

              <button
                className="btn btn-primary btn-with-icon"
                type="button"
                onClick={handleSaveFrame}
                disabled={isSaving || Boolean(downloadState)}
              >
                <EditIcon />
                <span>{isSaving ? "Salvando..." : "Salvar alterações do quadro"}</span>
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <span>Selecione um quadro à esquerda para começar a editar.</span>
            </div>
          )}
        </div>
        </AppModal>
      </section>

      <AppModal
        open={Boolean(downloadProgress)}
        title={downloadProgress?.title || ""}
        description={downloadProgress?.description || ""}
        variant="info"
        icon={<DownloadIcon />}
        closeOnBackdropClick={false}
      >
        <div className="download-progress-stack">
          <div className="download-progress-header">
            <strong>{downloadPercent}%</strong>
            <span>{downloadRemainingPercent}% restante(s)</span>
          </div>

          <div
            className="download-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={downloadPercent}
            aria-label="Progresso do download"
          >
            <span
              className="download-progress-fill"
              style={{ width: `${downloadPercent}%` }}
            />
          </div>

          <div className="download-progress-meta">
            <span>{downloadProgressMeta}</span>
            <span>{downloadPercent < 100 ? "Baixando..." : "Concluido"}</span>
          </div>
        </div>
      </AppModal>

      <AppModal
        open={Boolean(modal)}
        title={modal?.title || ""}
        description={modal?.description || ""}
        variant={modal?.variant || "warning"}
        icon={<NoticeIcon />}
        onClose={() => setModal(null)}
        secondaryAction={{
          label: modal?.onConfirm ? "Cancelar" : "Fechar",
          onClick: () => setModal(null),
          disabled: isSaving,
        }}
        primaryAction={
          modal?.onConfirm
            ? {
                label: modal?.confirmLabel || "Confirmar",
                onClick: () => {
                  modal.onConfirm?.();
                  setModal(null);
                },
                tone: modal?.confirmTone || "primary",
                disabled: isSaving,
              }
            : undefined
        }
      />
    </AppLayout>
  );
}
