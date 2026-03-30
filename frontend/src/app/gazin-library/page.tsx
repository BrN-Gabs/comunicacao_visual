"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/layout/app-modal";
import { AppLayout } from "@/components/layout/app-layout";
import { EditIcon } from "@/components/layout/edit-icon";
import { NoticeIcon } from "@/components/layout/notice-icon";
import { PageTitleCard } from "@/components/layout/page-title";
import { gazinLibraryPage } from "@/components/layout/page-registry";
import { PlusIcon } from "@/components/layout/plus-icon";
import { SearchIcon } from "@/components/layout/search-icon";
import { StatusToggleIcon } from "@/components/layout/status-toggle-icon";
import { TrashIcon } from "@/components/layout/trash-icon";
import { UploadIcon } from "@/components/layout/upload-icon";
import { useRouteTransition } from "@/components/transition/route-transition-provider";
import { useAuthGuard } from "@/hooks/use-auth";
import { resolveAssetUrl as buildImageSource } from "@/lib/app-urls";
import { getApiMessage } from "@/lib/api-error";
import { getStoredUser } from "@/lib/auth";
import { subscribeToAppRefresh } from "@/lib/app-refresh";
import { hasRoleAccess } from "@/lib/role-access";
import {
  formatFileSize,
  getImageUploadSizeError,
  MAX_IMAGE_UPLOAD_SIZE_LABEL,
} from "@/lib/upload";
import {
  createGazinLibraryImage,
  deleteGazinLibraryImage,
  listGazinLibraryImages,
  reuploadGazinLibraryImage,
  updateGazinLibraryImage,
  updateGazinLibraryImageStatus,
  uploadGazinLibraryImage,
} from "@/services/gazin-library.service";
import type {
  GazinLibraryImage,
  GazinLibraryImageStatus,
} from "@/types/gazin-library";

type FormMode = "create" | "edit";
type SourceMode = "upload" | "url";
type LibraryModalState =
  | {
      type: "confirm-delete";
      image: GazinLibraryImage;
    }
  | {
      type: "confirm-status";
      image: GazinLibraryImage;
      nextStatus: GazinLibraryImageStatus;
    }
  | {
      type: "error";
      title: string;
      message: string;
    }
  | null;

type GazinLibraryFormState = {
  title: string;
  description: string;
  imageUrl: string;
};

const emptyForm: GazinLibraryFormState = {
  title: "",
  description: "",
  imageUrl: "",
};

function isValidHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function isExternalImageUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function getStatusBadgeClass(status: GazinLibraryImageStatus) {
  return status === "ACTIVE" ? "badge-success" : "badge-neutral";
}

function getStatusLabel(status: GazinLibraryImageStatus) {
  return status === "ACTIVE" ? "Ativa" : "Inativa";
}

export default function GazinLibraryPage() {
  const router = useRouter();
  const { isReady } = useAuthGuard();
  const { startRouteTransition } = useRouteTransition();
  const storedUser = getStoredUser();
  const currentUserRole = storedUser.role ?? null;
  const canManageLibrary = hasRoleAccess(currentUserRole, "VIP");

  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | GazinLibraryImageStatus>(
    "",
  );
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [images, setImages] = useState<GazinLibraryImage[]>([]);
  const [totalImages, setTotalImages] = useState(0);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [imagesError, setImagesError] = useState("");

  const [formMode, setFormMode] = useState<FormMode>("create");
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formValues, setFormValues] = useState<GazinLibraryFormState>(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusActionImageId, setStatusActionImageId] = useState<string | null>(
    null,
  );
  const [deleteActionImageId, setDeleteActionImageId] = useState<string | null>(
    null,
  );
  const [libraryModal, setLibraryModal] = useState<LibraryModalState>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return subscribeToAppRefresh(() => {
      setRefreshVersion((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFilePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setSelectedFilePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  function clearSelectedFile() {
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSelectedFileChange(nextFile: File | null) {
    if (!nextFile) {
      clearSelectedFile();
      return;
    }

    const fileSizeError = getImageUploadSizeError([nextFile]);

    if (fileSizeError) {
      clearSelectedFile();
      setFormError(fileSizeError);
      return;
    }

    setFormError("");
    setSelectedFile(nextFile);
  }

  function openErrorModal(title: string, message: string) {
    setLibraryModal({
      type: "error",
      title,
      message,
    });
  }

  function closeLibraryModal() {
    if (deleteActionImageId || statusActionImageId) {
      return;
    }

    setLibraryModal(null);
  }

  const loadImages = useCallback(async () => {
    if (!isReady || !canManageLibrary) {
      return;
    }

    setIsLoadingImages(true);
    setImagesError("");

    try {
      const response = await listGazinLibraryImages({
        search: appliedSearch || undefined,
        status: statusFilter || undefined,
        page: 1,
        limit: 50,
      });

      setImages(response.items);
      setTotalImages(response.meta.total);
    } catch (error) {
      setImagesError(
        getApiMessage(error, "Não foi possível carregar as imagens da Gazin."),
      );
    } finally {
      setIsLoadingImages(false);
    }
  }, [appliedSearch, canManageLibrary, isReady, statusFilter]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!canManageLibrary) {
      startRouteTransition({
        label: "Voltando ao dashboard",
        minDuration: 700,
      });
      router.replace("/dashboard");
      return;
    }

    loadImages();
  }, [
    canManageLibrary,
    isReady,
    loadImages,
    refreshVersion,
    router,
    startRouteTransition,
  ]);

  function resetFormState() {
    setFormMode("create");
    setSourceMode("upload");
    setEditingImageId(null);
    setFormValues(emptyForm);
    clearSelectedFile();
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchTerm.trim());
  }

  function handleClearFilters() {
    setSearchTerm("");
    setAppliedSearch("");
    setStatusFilter("");
  }

  function handleStartCreate() {
    resetFormState();
    setFormError("");
    setFormSuccess("");
    setIsFormModalOpen(true);
  }

  function handleEditImage(image: GazinLibraryImage) {
    setFormMode("edit");
    setEditingImageId(image.id);
    setSourceMode(isExternalImageUrl(image.imageUrl) ? "url" : "upload");
    setFormValues({
      title: image.title,
      description: image.description,
      imageUrl: image.imageUrl,
    });
    clearSelectedFile();
    setFormError("");
    setFormSuccess("");
    setIsFormModalOpen(true);
  }

  function handleCloseFormModal() {
    if (isSubmitting) {
      return;
    }

    setIsFormModalOpen(false);
    setFormError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError("");
    setFormSuccess("");

    const title = formValues.title.trim();
    const description = formValues.description.trim();
    const imageUrl = formValues.imageUrl.trim();

    if (title.length < 2) {
      setFormError("Informe um título com pelo menos 2 caracteres.");
      setIsSubmitting(false);
      return;
    }

    if (description.length < 2) {
      setFormError("Informe uma descrição com pelo menos 2 caracteres.");
      setIsSubmitting(false);
      return;
    }

    if (formMode === "create" && sourceMode === "url" && !isValidHttpUrl(imageUrl)) {
      setFormError("Informe uma URL de imagem válida para continuar.");
      setIsSubmitting(false);
      return;
    }

    if (formMode === "create" && sourceMode === "upload" && !selectedFile) {
      setFormError("Selecione um arquivo de imagem para cadastrar.");
      setIsSubmitting(false);
      return;
    }

    if (formMode === "edit" && !editingImageId) {
      setFormError("Selecione uma imagem da Gazin para editar.");
      setIsSubmitting(false);
      return;
    }

    if (selectedFile) {
      const fileSizeError = getImageUploadSizeError([selectedFile]);

      if (fileSizeError) {
        setFormError(fileSizeError);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      if (formMode === "create") {
        if (sourceMode === "upload" && selectedFile) {
          await uploadGazinLibraryImage({
            title,
            description,
            file: selectedFile,
          });
        } else {
          await createGazinLibraryImage({
            title,
            description,
            imageUrl,
          });
        }

        resetFormState();
        setFormSuccess("Imagem da Gazin cadastrada com sucesso.");
      } else if (editingImageId) {
        const payload: {
          title: string;
          description: string;
          imageUrl?: string;
        } = {
          title,
          description,
        };

        if (isExternalImageUrl(imageUrl) && !selectedFile) {
          if (!isValidHttpUrl(imageUrl)) {
            setFormError("Informe uma URL de imagem valida para continuar.");
            setIsSubmitting(false);
            return;
          }

          payload.imageUrl = imageUrl;
        }

        await updateGazinLibraryImage(editingImageId, payload);

        if (selectedFile) {
          await reuploadGazinLibraryImage(editingImageId, selectedFile);
        }

        resetFormState();
        setFormSuccess("Imagem da Gazin atualizada com sucesso.");
      }

      await loadImages();
      setIsFormModalOpen(false);
    } catch (error) {
      setFormError(
        getApiMessage(error, "Não foi possível salvar a imagem da Gazin."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleStatus(image: GazinLibraryImage) {
    const nextStatus: GazinLibraryImageStatus =
      image.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    setLibraryModal({
      type: "confirm-status",
      image,
      nextStatus,
    });
  }

  /* Legacy flow replaced by modal.
    const nextStatus: GazinLibraryImageStatus =
      image.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setStatusActionImageId(image.id);
    setImagesError("");
    setFormSuccess("");

    try {
      await updateGazinLibraryImageStatus(image.id, nextStatus);
      setFormSuccess(
        nextStatus === "ACTIVE"
          ? "Imagem da Gazin reativada com sucesso."
          : "Imagem da Gazin inativada com sucesso.",
      );
      await loadImages();
    } catch (error) {
      openErrorModal(
        "Nao foi possivel atualizar o status",
        getApiMessage(
          error,
          "Nao foi possivel atualizar o status da imagem da Gazin.",
        ),
      );
    } finally {
      setStatusActionImageId(null);
    }

    return;

    try {
      await updateGazinLibraryImageStatus(image.id, nextStatus);
      setFormSuccess(
        nextStatus === "ACTIVE"
          ? "Imagem da Gazin reativada com sucesso."
          : "Imagem da Gazin inativada com sucesso.",
      );
      await loadImages();
    } catch (error) {
      setImagesError(
        getApiMessage(
          error,
          "NÃ£o foi possÃ­vel atualizar o status da imagem da Gazin.",
        ),
      );
    } finally {
      setStatusActionImageId(null);
    }
  */

  async function handleDeleteImage(image: GazinLibraryImage) {
    setLibraryModal({
      type: "confirm-delete",
      image,
    });
  }

  /* Legacy flow replaced by modal.
    setLibraryModal({
      type: "confirm-delete",
      image,
    });

    return;

    const confirmed = window.confirm(
      `Deseja remover a imagem ${image.title}? Essa aÃ§Ã£o nÃ£o pode ser desfeita.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleteActionImageId(image.id);
    setImagesError("");
    setFormSuccess("");

    try {
      await deleteGazinLibraryImage(image.id);

      if (editingImageId === image.id) {
        resetFormState();
      }

      setFormSuccess("Imagem da Gazin removida com sucesso.");
      await loadImages();
    } catch (error) {
      setImagesError(
        getApiMessage(error, "NÃ£o foi possÃ­vel remover a imagem da Gazin."),
      );
    } finally {
      setDeleteActionImageId(null);
    }
  */

  async function handleConfirmStatusChange() {
    if (!libraryModal || libraryModal.type !== "confirm-status") {
      return;
    }

    const { image, nextStatus } = libraryModal;

    setStatusActionImageId(image.id);
    setFormSuccess("");

    try {
      await updateGazinLibraryImageStatus(image.id, nextStatus);
      setLibraryModal(null);
      setFormSuccess(
        nextStatus === "ACTIVE"
          ? "Imagem da Gazin reativada com sucesso."
          : "Imagem da Gazin inativada com sucesso.",
      );
      await loadImages();
    } catch (error) {
      openErrorModal(
        "Não foi possível atualizar o status",
        getApiMessage(
          error,
          "Não foi possível atualizar o status da imagem da Gazin.",
        ),
      );
    } finally {
      setStatusActionImageId(null);
    }
  }

  async function handleConfirmDeleteImage() {
    if (!libraryModal || libraryModal.type !== "confirm-delete") {
      return;
    }

    const image = libraryModal.image;

    setDeleteActionImageId(image.id);
    setImagesError("");
    setFormSuccess("");

    try {
      await deleteGazinLibraryImage(image.id);
      setLibraryModal(null);

      if (editingImageId === image.id) {
        resetFormState();
      }

      setFormSuccess("Imagem da Gazin removida com sucesso.");
      await loadImages();
    } catch (error) {
      openErrorModal(
        "Não foi possível excluir a imagem",
        getApiMessage(error, "Não foi possível remover a imagem da Gazin."),
      );
    } finally {
      setDeleteActionImageId(null);
    }
  }

  if (!isReady || !canManageLibrary) {
    return null;
  }

  const currentPreviewUrl =
    selectedFilePreviewUrl || buildImageSource(formValues.imageUrl);
  const canEditExternalUrl =
    formMode === "create"
      ? sourceMode === "url"
      : isExternalImageUrl(formValues.imageUrl) && !selectedFile;
  const shouldShowFileInput = formMode === "edit" || sourceMode === "upload";
  const statusModal =
    libraryModal?.type === "confirm-status" ? libraryModal : null;
  const isDeleteModalOpen = libraryModal?.type === "confirm-delete";
  const deleteCandidate =
    libraryModal?.type === "confirm-delete" ? libraryModal.image : null;
  const errorModal = libraryModal?.type === "error" ? libraryModal : null;
  const isStatusModalOpen = Boolean(statusModal);
  const statusActionDescription = statusModal
    ? statusModal.nextStatus === "INACTIVE"
      ? `A imagem "${statusModal.image.title}" ficará indisponível para novos usos até ser reativada.`
      : `A imagem "${statusModal.image.title}" voltará a ficar disponível para uso nas comunicações visuais.`
    : "";

  return (
    <AppLayout>
      <PageTitleCard
        page={gazinLibraryPage}
        description="Cadastre, acompanhe e mantenha a biblioteca oficial de imagens da Gazin pronta para uso nas comunicações visuais."
        actions={
          <div className="users-toolbar">
            <form className="page-search" onSubmit={handleSearchSubmit}>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar imagens da Gazin"
                className="page-search-input"
                aria-label="Pesquisar imagens da Gazin"
              />
              <button
                className="btn btn-secondary btn-icon"
                type="submit"
                aria-label="Pesquisar imagens da Gazin"
                title="Pesquisar imagens da Gazin"
              >
                <SearchIcon />
              </button>
            </form>

            <div className="users-filters">
              <select
                className="app-select"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "" | GazinLibraryImageStatus)
                }
                aria-label="Filtrar por status"
              >
                <option value="">Todos os status</option>
                <option value="ACTIVE">Ativas</option>
                <option value="INACTIVE">Inativas</option>
              </select>

              <button
                className="btn btn-secondary"
                type="button"
                onClick={handleClearFilters}
              >
                Limpar
              </button>
            </div>
          </div>
        }
      />

      <section className="admin-users-grid is-single-column">
        <div className="panel panel-span-full">
          <div className="panel-header panel-header-inline">
            <div>
              <h3>Biblioteca Gazin</h3>
              <p>Lista operacional de imagens prontas para uso nas comunicações.</p>
            </div>

            <div className="panel-header-actions">
              <span className="user-list-meta">
                {totalImages} imagem(ns) encontrada(s)
              </span>
              <button
                className="btn btn-primary btn-with-icon"
                type="button"
                onClick={handleStartCreate}
              >
                <PlusIcon />
                Nova imagem
              </button>
            </div>
          </div>

          {formSuccess ? (
            <div className="inline-feedback success" role="status">
              {formSuccess}
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Imagem</th>
                  <th>Descrição</th>
                  <th>Status</th>
                  <th>Cadastrada por</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingImages ? (
                  <tr>
                    <td className="table-feedback" colSpan={5}>
                      Carregando imagens da Gazin...
                    </td>
                  </tr>
                ) : null}

                {!isLoadingImages && imagesError ? (
                  <tr>
                    <td className="table-feedback error" colSpan={5}>
                      {imagesError}
                    </td>
                  </tr>
                ) : null}

                {!isLoadingImages && !imagesError && images.length === 0 ? (
                  <tr>
                    <td className="table-feedback" colSpan={5}>
                      Nenhuma imagem da Gazin encontrada com os filtros atuais.
                    </td>
                  </tr>
                ) : null}

                {!isLoadingImages &&
                  !imagesError &&
                  images.map((image) => (
                    <tr key={image.id}>
                      <td>
                        <div className="library-image-cell">
                          {buildImageSource(image.imageUrl) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={buildImageSource(image.imageUrl)}
                              alt={image.title}
                              className="library-thumb"
                            />
                          ) : (
                            <span className="library-thumb library-thumb-placeholder">
                              Sem preview
                            </span>
                          )}

                          <div className="table-title-cell">
                            <strong>{image.title}</strong>
                            <span>
                              {new Date(image.createdAt).toLocaleDateString(
                                "pt-BR",
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="library-description-cell" title={image.description}>
                        {image.description}
                      </td>
                      <td>
                        <span
                          className={`badge ${getStatusBadgeClass(image.status)}`}
                        >
                          {getStatusLabel(image.status)}
                        </span>
                      </td>
                      <td>{image.createdBy?.name || "-"}</td>
                      <td>
                        <div className="table-action-row">
                          <button
                            className="table-action-button table-action-icon-button"
                            type="button"
                            onClick={() => handleEditImage(image)}
                            aria-label={`Editar imagem ${image.title}`}
                            title={`Editar imagem ${image.title}`}
                          >
                            <EditIcon />
                            <span className="sr-only">
                              Editar imagem {image.title}
                            </span>
                          </button>
                          <button
                            className={`table-action-button table-action-icon-button ${
                              image.status === "ACTIVE" ? "danger" : "success"
                            }`}
                            type="button"
                            onClick={() => handleToggleStatus(image)}
                            disabled={statusActionImageId === image.id}
                            aria-label={
                              statusActionImageId === image.id
                                ? `Atualizando status da imagem ${image.title}`
                                : image.status === "ACTIVE"
                                  ? `Inativar imagem ${image.title}`
                                  : `Reativar imagem ${image.title}`
                            }
                            title={
                              statusActionImageId === image.id
                                ? "Atualizando status"
                                : image.status === "ACTIVE"
                                  ? "Inativar imagem"
                                  : "Reativar imagem"
                            }
                          >
                            <StatusToggleIcon />
                            <span className="sr-only">
                              {statusActionImageId === image.id
                                ? `Atualizando status da imagem ${image.title}`
                                : image.status === "ACTIVE"
                                  ? `Inativar imagem ${image.title}`
                                  : `Reativar imagem ${image.title}`}
                            </span>
                          </button>
                          <button
                            className="table-action-button table-action-icon-button danger"
                            type="button"
                            onClick={() => handleDeleteImage(image)}
                            disabled={deleteActionImageId === image.id}
                            aria-label={
                              deleteActionImageId === image.id
                                ? `Removendo imagem ${image.title}`
                                : `Excluir imagem ${image.title}`
                            }
                            title={
                              deleteActionImageId === image.id
                                ? "Removendo imagem"
                                : "Excluir imagem"
                            }
                          >
                            <TrashIcon />
                            <span className="sr-only">
                              {deleteActionImageId === image.id
                                ? `Removendo imagem ${image.title}`
                                : `Excluir imagem ${image.title}`}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {false ? (
          <div className="panel">
          <div className="panel-header panel-header-inline">
            <div>
              <h3>
                {formMode === "create"
                  ? "Cadastrar imagem"
                  : "Editar imagem da Gazin"}
              </h3>
              <p>
                {formMode === "create"
                  ? "Cadastre por upload de arquivo ou usando uma URL externa."
                  : "Atualize tí­tulo, descrição e troque o arquivo quando precisar."}
              </p>
            </div>

            {formMode === "edit" ? (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={handleStartCreate}
              >
                Cancelar edição
              </button>
            ) : null}
          </div>

          <form className="user-form" onSubmit={handleSubmit}>
            {formMode === "create" ? (
              <div className="toggle-button-group" role="tablist" aria-label="Tipo de cadastro">
                <button
                  className={`toggle-button ${
                    sourceMode === "upload" ? "is-active" : ""
                  }`}
                  type="button"
                  onClick={() => {
                    setSourceMode("upload");
                    clearSelectedFile();
                  }}
                >
                  Upload
                </button>
                <button
                  className={`toggle-button ${
                    sourceMode === "url" ? "is-active" : ""
                  }`}
                  type="button"
                  onClick={() => {
                    setSourceMode("url");
                    clearSelectedFile();
                  }}
                >
                  URL externa
                </button>
              </div>
            ) : null}

            <div className="user-form-grid">
              <label className="field-stack">
                <span>Título</span>
                <input
                  type="text"
                  value={formValues.title}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Nome da imagem"
                />
              </label>

              <label className="field-stack">
                <span>Descrição</span>
                <textarea
                  value={formValues.description}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Descreva rapidamente onde essa imagem deve ser usada"
                />
              </label>

              {canEditExternalUrl ? (
                <label className="field-stack">
                  <span>URL da imagem</span>
                  <input
                    type="url"
                    value={formValues.imageUrl}
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        imageUrl: event.target.value,
                      }))
                    }
                    placeholder="https://exemplo.com/imagem.jpg"
                  />
                </label>
              ) : null}

              {shouldShowFileInput ? (
                <div className="field-stack">
                  <span>
                    {formMode === "create"
                      ? "Arquivo da imagem"
                      : "Substituir arquivo (opcional)"}
                  </span>

                  <input
                    ref={fileInputRef}
                    id="gazin-library-file-input"
                    className="file-input-native"
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      setSelectedFile(event.target.files?.[0] ?? null)
                    }
                  />

                  <div
                    className={`file-picker ${selectedFile ? "is-selected" : ""}`}
                  >
                    <div className="file-picker-shell">
                      <span className="file-picker-icon" aria-hidden="true">
                        <UploadIcon />
                      </span>

                      <div className="file-picker-copy">
                        <strong>
                          {selectedFile
                            ? selectedFile?.name
                            : formMode === "create"
                              ? "Selecione o arquivo principal da imagem"
                              : "Nenhum novo arquivo selecionado"}
                        </strong>
                        <span>
                          {selectedFile
                            ? `${formatFileSize(selectedFile?.size ?? 0)} • pronto para envio`
                            : formMode === "create"
                              ? `Envie JPG, PNG ou WebP com até ${MAX_IMAGE_UPLOAD_SIZE_LABEL}.`
                              : "Opcional. Envie um novo arquivo apenas se quiser substituir o atual."}
                        </span>
                      </div>
                    </div>

                    <div className="file-picker-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-with-icon file-picker-trigger"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <UploadIcon />
                        <span>
                          {selectedFile
                            ? "Trocar arquivo"
                            : formMode === "create"
                              ? "Escolher arquivo"
                              : "Selecionar arquivo"}
                        </span>
                      </button>

                      {selectedFile ? (
                        <button
                          className="file-picker-clear"
                          type="button"
                          onClick={clearSelectedFile}
                        >
                          Remover seleção
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="library-preview-card">
              {currentPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentPreviewUrl}
                  alt={formValues.title || "Preview da imagem da Gazin"}
                  className="library-preview-media"
                />
              ) : (
                <div className="library-preview-media library-thumb-placeholder">
                  Sem preview
                </div>
              )}

              <div className="library-preview-copy">
                <strong>{formValues.title.trim() || "Preview da imagem"}</strong>
                <p>
                  {formValues.description.trim() ||
                    "A imagem selecionada ou informada por URL aparecera aqui antes do cadastro."}
                </p>
              </div>
            </div>

            {formError ? (
              <div className="inline-feedback error" role="alert">
                {formError}
              </div>
            ) : null}

            {formSuccess ? (
              <div className="inline-feedback success" role="status">
                {formSuccess}
              </div>
            ) : null}

            <div className="user-form-actions">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? formMode === "create"
                    ? "Salvando..."
                    : "Atualizando..."
                  : formMode === "create"
                    ? "Cadastrar imagem"
                    : "Salvar alteracoes"}
              </button>

              <button
                className="btn btn-secondary"
                type="button"
                onClick={handleStartCreate}
              >
                Limpar formulário
              </button>
            </div>
          </form>
          </div>
        ) : null}
      </section>

      <AppModal
        open={isFormModalOpen}
        title={
          formMode === "create"
            ? "Cadastrar imagem"
            : "Editar imagem da Gazin"
        }
        description={
          formMode === "create"
            ? "Cadastre por upload de arquivo ou usando uma URL externa."
            : "Atualize título, descrição e troque o arquivo quando precisar."
        }
        variant="info"
        size="large"
        icon={formMode === "create" ? <PlusIcon /> : <EditIcon />}
        onClose={handleCloseFormModal}
        secondaryAction={{
          label: "Fechar",
          onClick: handleCloseFormModal,
          disabled: isSubmitting,
        }}
      >
        <form className="user-form" onSubmit={handleSubmit}>
          {formMode === "create" ? (
            <div
              className="toggle-button-group"
              role="tablist"
              aria-label="Tipo de cadastro"
            >
              <button
                className={`toggle-button ${
                  sourceMode === "upload" ? "is-active" : ""
                }`}
                type="button"
                onClick={() => {
                  setSourceMode("upload");
                  clearSelectedFile();
                }}
              >
                Upload
              </button>
              <button
                className={`toggle-button ${
                  sourceMode === "url" ? "is-active" : ""
                }`}
                type="button"
                onClick={() => {
                  setSourceMode("url");
                  clearSelectedFile();
                }}
              >
                URL externa
              </button>
            </div>
          ) : null}

          <div className="user-form-grid">
            <label className="field-stack">
              <span>Título</span>
              <input
                type="text"
                value={formValues.title}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Nome da imagem"
              />
            </label>

            <label className="field-stack">
              <span>Descrição</span>
              <textarea
                value={formValues.description}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={4}
                placeholder="Descreva rapidamente onde essa imagem deve ser usada"
              />
            </label>

            {canEditExternalUrl ? (
              <label className="field-stack">
                <span>URL da imagem</span>
                <input
                  type="url"
                  value={formValues.imageUrl}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      imageUrl: event.target.value,
                    }))
                  }
                  placeholder="https://exemplo.com/imagem.jpg"
                />
              </label>
            ) : null}

            {shouldShowFileInput ? (
              <div className="field-stack">
                <span>
                  {formMode === "create"
                    ? "Arquivo da imagem"
                    : "Substituir arquivo (opcional)"}
                </span>

                  <input
                    ref={fileInputRef}
                    id="gazin-library-file-input-modal"
                    className="file-input-native"
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      handleSelectedFileChange(event.target.files?.[0] ?? null)
                    }
                  />

                <div
                  className={`file-picker ${selectedFile ? "is-selected" : ""}`}
                >
                  <div className="file-picker-shell">
                    <span className="file-picker-icon" aria-hidden="true">
                      <UploadIcon />
                    </span>

                    <div className="file-picker-copy">
                        <strong>
                          {selectedFile
                            ? selectedFile?.name
                            : formMode === "create"
                              ? "Selecione o arquivo principal da imagem"
                              : "Nenhum novo arquivo selecionado"}
                        </strong>
                        <span>
                          {selectedFile
                            ? `${formatFileSize(selectedFile?.size ?? 0)} - pronto para envio`
                            : formMode === "create"
                              ? `Envie JPG, PNG ou WebP com até ${MAX_IMAGE_UPLOAD_SIZE_LABEL}.`
                              : "Opcional. Envie um novo arquivo apenas se quiser substituir o atual."}
                      </span>
                    </div>
                  </div>

                  <div className="file-picker-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-with-icon file-picker-trigger"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadIcon />
                      <span>
                        {selectedFile
                          ? "Trocar arquivo"
                          : formMode === "create"
                            ? "Escolher arquivo"
                            : "Selecionar arquivo"}
                      </span>
                    </button>

                    {selectedFile ? (
                      <button
                        className="file-picker-clear"
                        type="button"
                        onClick={clearSelectedFile}
                      >
                        Remover seleção
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="library-preview-card">
            {currentPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentPreviewUrl}
                alt={formValues.title || "Preview da imagem da Gazin"}
                className="library-preview-media"
              />
            ) : (
              <div className="library-preview-media library-thumb-placeholder">
                Sem preview
              </div>
            )}

            <div className="library-preview-copy">
              <strong>{formValues.title.trim() || "Preview da imagem"}</strong>
              <p>
                {formValues.description.trim() ||
                  "A imagem selecionada ou informada por URL aparecera aqui antes do cadastro."}
              </p>
            </div>
          </div>

          {formError ? (
            <div className="inline-feedback error" role="alert">
              {formError}
            </div>
          ) : null}

          <div className="user-form-actions">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? formMode === "create"
                  ? "Salvando..."
                  : "Atualizando..."
                : formMode === "create"
                  ? "Cadastrar imagem"
                  : "Salvar alteracoes"}
            </button>

            <button
              className="btn btn-secondary"
              type="button"
              onClick={handleStartCreate}
            >
              {formMode === "create" ? "Limpar formulário" : "Nova imagem"}
            </button>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={Boolean(libraryModal)}
        title={
          isDeleteModalOpen
            ? "Excluir imagem da Gazin?"
            : isStatusModalOpen
              ? statusModal?.nextStatus === "INACTIVE"
                ? "Inativar imagem da Gazin?"
                : "Reativar imagem da Gazin?"
              : errorModal?.title || ""
        }
        description={
          isDeleteModalOpen && deleteCandidate
            ? `A imagem "${deleteCandidate.title}" será removida da biblioteca. Essa ação não pode ser desfeita.`
            : isStatusModalOpen
              ? statusActionDescription
              : errorModal?.message || ""
        }
        variant={
          isDeleteModalOpen
            ? "danger"
            : isStatusModalOpen
              ? statusModal?.nextStatus === "INACTIVE"
                ? "danger"
                : "success"
              : "warning"
        }
        icon={
          isDeleteModalOpen ? (
            <TrashIcon />
          ) : isStatusModalOpen ? (
            <StatusToggleIcon />
          ) : (
            <NoticeIcon />
          )
        }
        onClose={closeLibraryModal}
        secondaryAction={{
          label: isDeleteModalOpen || isStatusModalOpen ? "Cancelar" : "Fechar",
          onClick: closeLibraryModal,
          disabled:
            deleteActionImageId !== null || statusActionImageId !== null,
        }}
        primaryAction={
          isDeleteModalOpen
            ? {
                label:
                  deleteActionImageId !== null
                    ? "Excluindo..."
                    : "Confirmar exclusão",
                onClick: handleConfirmDeleteImage,
                tone: "danger",
                icon: <TrashIcon />,
                disabled: deleteActionImageId !== null,
              }
            : isStatusModalOpen
              ? {
                  label:
                    statusActionImageId !== null
                      ? statusModal?.nextStatus === "INACTIVE"
                        ? "Inativando..."
                        : "Reativando..."
                      : statusModal?.nextStatus === "INACTIVE"
                        ? "Confirmar inativação"
                        : "Confirmar reativação",
                  onClick: handleConfirmStatusChange,
                  tone:
                    statusModal?.nextStatus === "INACTIVE"
                      ? "danger"
                      : "primary",
                  icon: <StatusToggleIcon />,
                  disabled: statusActionImageId !== null,
                }
              : undefined
        }
      />
    </AppLayout>
  );
}
