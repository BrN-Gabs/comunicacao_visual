"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/layout/app-modal";
import { AppLayout } from "@/components/layout/app-layout";
import { EditIcon } from "@/components/layout/edit-icon";
import { NoticeIcon } from "@/components/layout/notice-icon";
import { PageTitleCard } from "@/components/layout/page-title";
import { cityLibraryPage } from "@/components/layout/page-registry";
import { PlusIcon } from "@/components/layout/plus-icon";
import { SearchIcon } from "@/components/layout/search-icon";
import { TrashIcon } from "@/components/layout/trash-icon";
import { UploadIcon } from "@/components/layout/upload-icon";
import { useRouteTransition } from "@/components/transition/route-transition-provider";
import { useAuthGuard } from "@/hooks/use-auth";
import { getStoredUser } from "@/lib/auth";
import { resolveAssetUrl as buildImageSource } from "@/lib/app-urls";
import { getApiErrorMessage } from "@/lib/api-error";
import { subscribeToAppRefresh } from "@/lib/app-refresh";
import { hasRoleAccess } from "@/lib/role-access";
import {
  getBatchImageUploadSizeError,
  formatFileSize,
  getImageUploadSizeError,
  MAX_BATCH_IMAGE_UPLOAD_SIZE_LABEL,
  MAX_IMAGE_UPLOAD_SIZE_LABEL,
} from "@/lib/upload";
import {
  createCityLibraryCity,
  createCityPhotographer,
  deleteCityLibraryCity,
  deleteCityLibraryImage,
  deleteCityPhotographer,
  getCityLibraryCity,
  listCityLibraryCities,
  uploadCityPhotographerImages,
  updateCityLibraryCity,
  updateCityPhotographer,
} from "@/services/city-library.service";
import type {
  CityLibraryCityDetails,
  CityLibraryCityListItem,
  CityLibraryImage,
  CityPhotographer,
} from "@/types/city-library";

type FormMode = "create" | "edit";
type CityLibraryModalState =
  | { type: "confirm-delete-city"; city: CityLibraryCityListItem }
  | { type: "confirm-delete-photographer"; photographer: CityPhotographer }
  | { type: "confirm-delete-image"; image: CityLibraryImage }
  | { type: "error"; title: string; message: string }
  | null;

export default function CityLibraryPage() {
  const router = useRouter();
  const { isReady } = useAuthGuard();
  const { startRouteTransition } = useRouteTransition();
  const storedUser = getStoredUser();
  const currentUserRole = storedUser.role ?? null;
  const canManageLibrary = hasRoleAccess(currentUserRole, "VIP");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [cities, setCities] = useState<CityLibraryCityListItem[]>([]);
  const [totalCities, setTotalCities] = useState(0);
  const [selectedCityId, setSelectedCityId] = useState("");
  const [selectedCity, setSelectedCity] = useState<CityLibraryCityDetails | null>(
    null,
  );
  const [selectedPhotographerId, setSelectedPhotographerId] = useState("");
  const [isLoadingCities, setIsLoadingCities] = useState(true);
  const [isLoadingSelectedCity, setIsLoadingSelectedCity] = useState(false);
  const [listError, setListError] = useState("");
  const [detailsError, setDetailsError] = useState("");

  const [cityFormMode, setCityFormMode] = useState<FormMode>("create");
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [isCityFormModalOpen, setIsCityFormModalOpen] = useState(false);
  const [cityName, setCityName] = useState("");
  const [cityState, setCityState] = useState("");
  const [cityFormError, setCityFormError] = useState("");
  const [cityFormSuccess, setCityFormSuccess] = useState("");
  const [isSavingCity, setIsSavingCity] = useState(false);

  const [photographerFormMode, setPhotographerFormMode] =
    useState<FormMode>("create");
  const [editingPhotographerId, setEditingPhotographerId] = useState<string | null>(
    null,
  );
  const [isPhotographerFormModalOpen, setIsPhotographerFormModalOpen] =
    useState(false);
  const [photographerName, setPhotographerName] = useState("");
  const [photographerError, setPhotographerError] = useState("");
  const [photographerSuccess, setPhotographerSuccess] = useState("");
  const [isSavingPhotographer, setIsSavingPhotographer] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isImagesModalOpen, setIsImagesModalOpen] = useState(false);
  const [imagesError, setImagesError] = useState("");
  const [imagesSuccess, setImagesSuccess] = useState("");
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [deleteActionId, setDeleteActionId] = useState<string | null>(null);
  const [modal, setModal] = useState<CityLibraryModalState>(null);

  const selectedPhotographer = useMemo(() => {
    if (!selectedCity || !selectedPhotographerId) return null;
    return (
      selectedCity.photographers.find(
        (photographer) => photographer.id === selectedPhotographerId,
      ) ?? null
    );
  }, [selectedCity, selectedPhotographerId]);

  const loadCities = useCallback(async () => {
    if (!isReady || !canManageLibrary) return;

    setIsLoadingCities(true);
    setListError("");

    try {
      const response = await listCityLibraryCities({
        search: appliedSearch || undefined,
        page: 1,
        limit: 100,
      });

      setCities(response.items);
      setTotalCities(response.meta.total);
      setSelectedCityId((current) => {
        if (current && response.items.some((city) => city.id === current)) {
          return current;
        }

        return response.items[0]?.id ?? "";
      });
    } catch (error) {
      setCities([]);
      setSelectedCityId("");
      setListError(
        getApiErrorMessage(error, "Não foi possível carregar as cidades."),
      );
    } finally {
      setIsLoadingCities(false);
    }
  }, [appliedSearch, canManageLibrary, isReady]);

  const loadSelectedCity = useCallback(async () => {
    if (!selectedCityId) {
      setSelectedCity(null);
      setSelectedPhotographerId("");
      return;
    }

    setIsLoadingSelectedCity(true);
    setDetailsError("");

    try {
      const response = await getCityLibraryCity(selectedCityId);
      setSelectedCity(response);
      setSelectedPhotographerId((current) => {
        if (
          current &&
          response.photographers.some((photographer) => photographer.id === current)
        ) {
          return current;
        }

        return response.photographers[0]?.id ?? "";
      });
    } catch (error) {
      setSelectedCity(null);
      setSelectedPhotographerId("");
      setDetailsError(
        getApiErrorMessage(error, "Não foi possível carregar os detalhes da cidade."),
      );
    } finally {
      setIsLoadingSelectedCity(false);
    }
  }, [selectedCityId]);

  useEffect(() => {
    return subscribeToAppRefresh(() => {
      setRefreshVersion((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    if (!isReady) return;

    if (!canManageLibrary) {
      startRouteTransition({
        label: "Voltando ao dashboard",
        minDuration: 700,
      });
      router.replace("/dashboard");
      return;
    }

    void loadCities();
  }, [
    canManageLibrary,
    isReady,
    loadCities,
    refreshVersion,
    router,
    startRouteTransition,
  ]);

  useEffect(() => {
    if (!isReady || !canManageLibrary) return;
    void loadSelectedCity();
  }, [canManageLibrary, isReady, loadSelectedCity]);

  function resetCityForm() {
    setCityFormMode("create");
    setEditingCityId(null);
    setCityName("");
    setCityState("");
  }

  function resetPhotographerForm() {
    setPhotographerFormMode("create");
    setEditingPhotographerId(null);
    setPhotographerName("");
  }

  function clearSelectedFiles() {
    setSelectedFiles([]);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }

  function handleSelectedFilesChange(files: File[]) {
    const fileSizeError = getImageUploadSizeError(files);

    if (fileSizeError) {
      clearSelectedFiles();
      setImagesError(fileSizeError);
      return;
    }

    const batchSizeError = getBatchImageUploadSizeError(files);

    if (batchSizeError) {
      clearSelectedFiles();
      setImagesError(batchSizeError);
      return;
    }

    setImagesError("");
    setSelectedFiles(files);
  }

  function openErrorModal(title: string, message: string) {
    setModal({
      type: "error",
      title,
      message,
    });
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchTerm.trim());
  }

  function handleClearFilters() {
    setSearchTerm("");
    setAppliedSearch("");
  }

  function handleStartCreateCity() {
    resetCityForm();
    setCityFormError("");
    setCityFormSuccess("");
    setIsCityFormModalOpen(true);
  }

  function handleEditCity(city: CityLibraryCityListItem) {
    setCityFormMode("edit");
    setEditingCityId(city.id);
    setCityName(city.name);
    setCityState(city.state);
    setCityFormError("");
    setCityFormSuccess("");
    setIsCityFormModalOpen(true);
  }

  function handleCloseCityFormModal() {
    if (isSavingCity) {
      return;
    }

    setIsCityFormModalOpen(false);
    setCityFormError("");
  }

  function handleStartCreatePhotographer() {
    resetPhotographerForm();
    setPhotographerError("");
    setPhotographerSuccess("");
    setIsPhotographerFormModalOpen(true);
  }

  function handleEditPhotographer(photographer: CityPhotographer) {
    setPhotographerFormMode("edit");
    setEditingPhotographerId(photographer.id);
    setPhotographerName(photographer.name);
    setPhotographerError("");
    setPhotographerSuccess("");
    setIsPhotographerFormModalOpen(true);
  }

  function handleClosePhotographerFormModal() {
    if (isSavingPhotographer) {
      return;
    }

    setIsPhotographerFormModalOpen(false);
    setPhotographerError("");
  }

  function handleOpenImagesModal() {
    setImagesError("");
    setImagesSuccess("");
    setIsImagesModalOpen(true);
  }

  function handleCloseImagesModal() {
    if (isUploadingImages) {
      return;
    }

    setIsImagesModalOpen(false);
    setImagesError("");
    clearSelectedFiles();
  }

  async function handleCitySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingCity(true);
    setCityFormError("");
    setCityFormSuccess("");

    const payload = {
      name: cityName.trim(),
      state: cityState.trim().toUpperCase(),
    };

    if (!payload.name) {
      setCityFormError("Informe o nome da cidade.");
      setIsSavingCity(false);
      return;
    }

    if (payload.state.length !== 2) {
      setCityFormError("Informe a UF com 2 caracteres.");
      setIsSavingCity(false);
      return;
    }

    try {
      const response =
        cityFormMode === "create"
          ? await createCityLibraryCity(payload)
          : await updateCityLibraryCity(editingCityId as string, payload);

      resetCityForm();
      setSelectedCityId(response.id);
      setCityFormSuccess(
        cityFormMode === "create"
          ? "Cidade cadastrada com sucesso."
          : "Cidade atualizada com sucesso.",
      );
      await loadCities();
      await loadSelectedCity();
      setIsCityFormModalOpen(false);
    } catch (error) {
      setCityFormError(
        getApiErrorMessage(error, "Não foi possível salvar a cidade."),
      );
    } finally {
      setIsSavingCity(false);
    }
  }

  async function handlePhotographerSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedCity) {
      setPhotographerError("Selecione uma cidade antes de cadastrar o fotógrafo.");
      return;
    }

    setIsSavingPhotographer(true);
    setPhotographerError("");
    setPhotographerSuccess("");

    const payload = { name: photographerName.trim() };

    if (!payload.name) {
      setPhotographerError("Informe o nome do fotógrafo.");
      setIsSavingPhotographer(false);
      return;
    }

    try {
      const response =
        photographerFormMode === "create"
          ? await createCityPhotographer(selectedCity.id, payload)
          : await updateCityPhotographer(editingPhotographerId as string, payload);

      resetPhotographerForm();
      setSelectedPhotographerId(response.id);
      setPhotographerSuccess(
        photographerFormMode === "create"
          ? "Fotógrafo cadastrado com sucesso."
          : "Fotógrafo atualizado com sucesso.",
      );
      await loadCities();
      await loadSelectedCity();
      setIsPhotographerFormModalOpen(false);
    } catch (error) {
      setPhotographerError(
        getApiErrorMessage(error, "Não foi possível salvar o fotógrafo."),
      );
    } finally {
      setIsSavingPhotographer(false);
    }
  }

  async function handleUploadImages() {
    if (!selectedPhotographer) {
      setImagesError("Selecione um fotógrafo para enviar as imagens.");
      return;
    }

    if (!selectedFiles.length) {
      setImagesError("Selecione pelo menos um arquivo de imagem.");
      return;
    }

    const fileSizeError = getImageUploadSizeError(selectedFiles);

    if (fileSizeError) {
      setImagesError(fileSizeError);
      return;
    }

    const batchSizeError = getBatchImageUploadSizeError(selectedFiles);

    if (batchSizeError) {
      setImagesError(batchSizeError);
      return;
    }

    setIsUploadingImages(true);
    setImagesError("");
    setImagesSuccess("");

    try {
      const response = await uploadCityPhotographerImages(
        selectedPhotographer.id,
        selectedFiles,
      );
      setSelectedCity(response);
      setSelectedPhotographerId(selectedPhotographer.id);
      clearSelectedFiles();
      setImagesSuccess("Imagens enviadas com sucesso.");
      await loadCities();
      setIsImagesModalOpen(false);
    } catch (error) {
      setImagesError(
        getApiErrorMessage(error, "Não foi possível enviar as imagens."),
      );
    } finally {
      setIsUploadingImages(false);
    }
  }

  async function handleConfirmDelete() {
    if (!modal) return;

    setDeleteActionId(
      modal.type === "confirm-delete-city"
        ? modal.city.id
        : modal.type === "confirm-delete-photographer"
          ? modal.photographer.id
          : modal.type === "confirm-delete-image"
            ? modal.image.id
            : null,
    );

    try {
      if (modal.type === "confirm-delete-city") {
        await deleteCityLibraryCity(modal.city.id);

        if (editingCityId === modal.city.id) {
          resetCityForm();
        }

        if (selectedCityId === modal.city.id) {
          setSelectedCityId("");
        }

        setCityFormSuccess("Cidade removida com sucesso.");
      }

      if (modal.type === "confirm-delete-photographer") {
        await deleteCityPhotographer(modal.photographer.id);

        if (editingPhotographerId === modal.photographer.id) {
          resetPhotographerForm();
        }

        if (selectedPhotographerId === modal.photographer.id) {
          setSelectedPhotographerId("");
        }

        setPhotographerSuccess("Fotógrafo removido com sucesso.");
      }

      if (modal.type === "confirm-delete-image") {
        await deleteCityLibraryImage(modal.image.id);
        setImagesSuccess("Imagem removida com sucesso.");
      }

      setModal(null);
      await loadCities();
      await loadSelectedCity();
    } catch (error) {
      openErrorModal(
        "Não foi possível concluir a exclusão",
        getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      );
    } finally {
      setDeleteActionId(null);
    }
  }

  if (!isReady || !canManageLibrary) {
    return null;
  }

  const errorModal = modal?.type === "error" ? modal : null;
  const selectedCityTitle = selectedCity?.fullName || "Selecione uma cidade";

  return (
    <AppLayout>
      <PageTitleCard
        page={cityLibraryPage}
        description="Cadastre as cidades, organize os fotógrafos e mantenha o acervo das fotos pronto para montar as comunicações visuais."
        actions={
          <div className="users-toolbar">
            <form className="page-search" onSubmit={handleSearchSubmit}>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar cidade"
                className="page-search-input"
                aria-label="Pesquisar cidade"
              />
              <button
                className="btn btn-secondary btn-icon"
                type="submit"
                aria-label="Pesquisar cidade"
                title="Pesquisar cidade"
              >
                <SearchIcon />
              </button>
            </form>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={handleClearFilters}
            >
              Limpar
            </button>
          </div>
        }
      />

      <section className="admin-users-grid">
        <div className="panel panel-span-full">
          <div className="panel-header panel-header-inline">
            <div>
              <h3>Cidades cadastradas</h3>
              <p>Escolha a cidade que vai abastecer a comunicação visual.</p>
            </div>
            <div className="panel-header-actions">
              <span className="user-list-meta">
                {totalCities} cidade(s) encontrada(s)
              </span>
              <button
                className="btn btn-primary btn-with-icon"
                type="button"
                onClick={handleStartCreateCity}
              >
                <PlusIcon />
                Nova cidade
              </button>
            </div>
          </div>

          {cityFormSuccess ? (
            <div className="inline-feedback success">{cityFormSuccess}</div>
          ) : null}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cidade</th>
                  <th>Fotógrafos</th>
                  <th>Imagens</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingCities ? (
                  <tr>
                    <td className="table-feedback" colSpan={4}>
                      Carregando cidades...
                    </td>
                  </tr>
                ) : null}

                {!isLoadingCities && listError ? (
                  <tr>
                    <td className="table-feedback error" colSpan={4}>
                      {listError}
                    </td>
                  </tr>
                ) : null}

                {!isLoadingCities && !listError && cities.length === 0 ? (
                  <tr>
                    <td className="table-feedback" colSpan={4}>
                      Nenhuma cidade encontrada com os filtros atuais.
                    </td>
                  </tr>
                ) : null}

                {!isLoadingCities &&
                  !listError &&
                  cities.map((city) => (
                    <tr
                      key={city.id}
                      className={selectedCityId === city.id ? "is-selected-row" : ""}
                    >
                      <td>
                        <button
                          className="table-link-button"
                          type="button"
                          onClick={() => setSelectedCityId(city.id)}
                        >
                          <div className="table-title-cell">
                            <strong>{city.fullName}</strong>
                            <span>
                              Atualizada em {" "}
                              {new Date(city.updatedAt).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </button>
                      </td>
                      <td>{city.photographersCount}</td>
                      <td>{city.imagesCount}</td>
                      <td>
                        <div className="table-action-row">
                          <button
                            className="table-action-button table-action-icon-button"
                            type="button"
                            onClick={() => handleEditCity(city)}
                            aria-label={`Editar cidade ${city.fullName}`}
                            title={`Editar cidade ${city.fullName}`}
                          >
                            <EditIcon />
                          </button>
                          <button
                            className="table-action-button table-action-icon-button danger"
                            type="button"
                            onClick={() =>
                              setModal({ type: "confirm-delete-city", city })
                            }
                            disabled={deleteActionId === city.id}
                            aria-label={`Excluir cidade ${city.fullName}`}
                            title={`Excluir cidade ${city.fullName}`}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel city-library-detail-panel">
          <div className="panel-header panel-header-inline">
            <div>
              <h3>{selectedCityTitle}</h3>
              <p>Gerencie os fotógrafos e o acervo da cidade selecionada.</p>
            </div>
          </div>

          {isLoadingSelectedCity ? (
            <div className="table-feedback">Carregando detalhes da cidade...</div>
          ) : null}

          {!isLoadingSelectedCity && detailsError ? (
            <div className="inline-feedback error">{detailsError}</div>
          ) : null}

          {!isLoadingSelectedCity && !detailsError && !selectedCity ? (
            <div className="city-library-empty">
              Selecione uma cidade para ver os fotógrafos e as imagens.
            </div>
          ) : null}

          {selectedCity ? (
            <div className="city-library-detail-stack">
              <div className="communication-review-grid">
                <article className="communication-review-card">
                  <span>Fotógrafos</span>
                  <strong>{selectedCity.photographersCount}</strong>
                </article>
                <article className="communication-review-card">
                  <span>Imagens</span>
                  <strong>{selectedCity.imagesCount}</strong>
                </article>
              </div>

              <div className="city-library-photographer-layout">
                <div className="panel panel-subsection">
                  <div className="panel-header panel-header-inline">
                    <div>
                      <h3>Fotógrafos</h3>
                      <p>Selecione quem assina as fotos desta cidade.</p>
                    </div>
                    <button
                      className="btn btn-primary btn-with-icon"
                      type="button"
                      onClick={handleStartCreatePhotographer}
                    >
                      <PlusIcon />
                      Novo fotógrafo
                    </button>
                  </div>

                  {photographerSuccess ? (
                    <div className="inline-feedback success">
                      {photographerSuccess}
                    </div>
                  ) : null}

                  <div className="city-library-photographer-grid">
                    {selectedCity.photographers.map((photographer) => (
                      <article
                        key={photographer.id}
                        className={`city-library-photographer-card ${
                          selectedPhotographerId === photographer.id
                            ? "is-selected"
                            : ""
                        }`}
                      >
                        <button
                          className="city-library-photographer-main"
                          type="button"
                          onClick={() => setSelectedPhotographerId(photographer.id)}
                        >
                          <strong>{photographer.name}</strong>
                          <span>{photographer.images.length} imagem(ns)</span>
                        </button>
                        <div className="table-action-row">
                          <button
                            className="table-action-button table-action-icon-button"
                            type="button"
                            onClick={() => handleEditPhotographer(photographer)}
                            aria-label={`Editar fotógrafo ${photographer.name}`}
                            title={`Editar fotógrafo ${photographer.name}`}
                          >
                            <EditIcon />
                          </button>
                          <button
                            className="table-action-button table-action-icon-button danger"
                            type="button"
                            onClick={() =>
                              setModal({
                                type: "confirm-delete-photographer",
                                photographer,
                              })
                            }
                            disabled={deleteActionId === photographer.id}
                            aria-label={`Excluir fotógrafo ${photographer.name}`}
                            title={`Excluir fotógrafo ${photographer.name}`}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </article>
                    ))}

                    {!selectedCity.photographers.length ? (
                      <div className="city-library-empty">
                        Nenhum fotógrafo cadastrado nesta cidade ainda.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="panel panel-subsection">
                <div className="panel-header panel-header-inline">
                  <div>
                    <h3>
                      {selectedPhotographer
                        ? `Imagens de ${selectedPhotographer.name}`
                        : "Selecione um fotógrafo"}
                    </h3>
                    <p>Faça upload das imagens da cidade que este fotógrafo assina.</p>
                  </div>
                  {selectedPhotographer ? (
                    <button
                      className="btn btn-primary btn-with-icon"
                      type="button"
                      onClick={handleOpenImagesModal}
                    >
                      <UploadIcon />
                      Adicionar imagens
                    </button>
                  ) : null}
                </div>

                {selectedPhotographer ? (
                  <div className="city-library-gallery-stack">
                    {imagesSuccess ? (
                      <div className="inline-feedback success">{imagesSuccess}</div>
                    ) : null}

                    <div className="city-library-gallery">
                      {selectedPhotographer.images.map((image) => (
                        <article key={image.id} className="city-library-gallery-card">
                          <div className="city-library-gallery-preview">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={buildImageSource(image.imageUrl)}
                              alt={image.fileName || selectedPhotographer.name}
                            />
                          </div>
                          <div className="city-library-gallery-copy">
                            <strong>{image.fileName || "Imagem da cidade"}</strong>
                            <span>
                              {new Date(image.createdAt).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          <div className="table-action-row">
                            <button
                              className="table-action-button table-action-icon-button danger"
                              type="button"
                              onClick={() =>
                                setModal({ type: "confirm-delete-image", image })
                              }
                              disabled={deleteActionId === image.id}
                              aria-label={`Excluir imagem ${image.fileName || image.id}`}
                              title={`Excluir imagem ${image.fileName || image.id}`}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </article>
                      ))}

                      {!selectedPhotographer.images.length ? (
                        <div className="city-library-empty">
                          Este fotógrafo ainda não possui imagens cadastradas.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="city-library-empty">
                    Selecione um fotógrafo para visualizar e enviar imagens.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <AppModal
        open={isCityFormModalOpen}
        title={cityFormMode === "create" ? "Cadastrar cidade" : "Editar cidade"}
        description="Informe a cidade e a UF que vão agrupar fotógrafos e imagens."
        variant="info"
        icon={cityFormMode === "create" ? <PlusIcon /> : <EditIcon />}
        onClose={handleCloseCityFormModal}
        secondaryAction={{
          label: "Fechar",
          onClick: handleCloseCityFormModal,
          disabled: isSavingCity,
        }}
      >
        <form className="user-form" onSubmit={handleCitySubmit}>
          <div className="user-form-grid">
            <label className="field-stack">
              <span>Cidade</span>
              <input
                type="text"
                value={cityName}
                onChange={(event) => setCityName(event.target.value)}
                placeholder="Patos de Minas"
              />
            </label>
            <label className="field-stack">
              <span>UF</span>
              <input
                type="text"
                maxLength={2}
                value={cityState}
                onChange={(event) =>
                  setCityState(event.target.value.toUpperCase())
                }
                placeholder="MG"
              />
            </label>
          </div>

          {cityFormError ? (
            <div className="inline-feedback error">{cityFormError}</div>
          ) : null}

          <div className="user-form-actions">
            <button className="btn btn-primary" type="submit" disabled={isSavingCity}>
              {isSavingCity
                ? cityFormMode === "create"
                  ? "Salvando..."
                  : "Atualizando..."
                : cityFormMode === "create"
                  ? "Cadastrar cidade"
                  : "Salvar alterações"}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={handleStartCreateCity}
            >
              {cityFormMode === "create" ? "Limpar formulário" : "Nova cidade"}
            </button>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={isPhotographerFormModalOpen}
        title={
          photographerFormMode === "create"
            ? "Cadastrar fotógrafo"
            : "Editar fotógrafo"
        }
        description="O fotógrafo organiza as imagens que a comunicação poderá usar."
        variant="info"
        icon={photographerFormMode === "create" ? <PlusIcon /> : <EditIcon />}
        onClose={handleClosePhotographerFormModal}
        secondaryAction={{
          label: "Fechar",
          onClick: handleClosePhotographerFormModal,
          disabled: isSavingPhotographer,
        }}
      >
        <form className="user-form" onSubmit={handlePhotographerSubmit}>
          <label className="field-stack">
            <span>Nome do fotógrafo</span>
            <input
              type="text"
              value={photographerName}
              onChange={(event) => setPhotographerName(event.target.value)}
              placeholder="Ex.: Ademir José da Silva"
            />
          </label>

          {photographerError ? (
            <div className="inline-feedback error">{photographerError}</div>
          ) : null}

          <div className="user-form-actions">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={isSavingPhotographer}
            >
              {isSavingPhotographer
                ? photographerFormMode === "create"
                  ? "Salvando..."
                  : "Atualizando..."
                : photographerFormMode === "create"
                  ? "Cadastrar fotógrafo"
                  : "Salvar alterações"}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={handleStartCreatePhotographer}
            >
              {photographerFormMode === "create"
                ? "Limpar formulário"
                : "Novo fotógrafo"}
            </button>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={isImagesModalOpen}
        title={
          selectedPhotographer
            ? `Adicionar imagens de ${selectedPhotographer.name}`
            : "Adicionar imagens"
        }
        description="Envie as imagens da cidade para o fotógrafo selecionado."
        variant="info"
        size="large"
        icon={<UploadIcon />}
        onClose={handleCloseImagesModal}
        secondaryAction={{
          label: "Fechar",
          onClick: handleCloseImagesModal,
          disabled: isUploadingImages,
        }}
      >
        <div className="user-form">
          <input
            ref={uploadInputRef}
            className="file-input-native"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) =>
              handleSelectedFilesChange(Array.from(event.target.files || []))
            }
          />

          <div className={`file-picker ${selectedFiles.length ? "is-selected" : ""}`}>
            <div className="file-picker-shell">
              <span className="file-picker-icon" aria-hidden="true">
                <UploadIcon />
              </span>
              <div className="file-picker-copy">
                <strong>
                  {selectedFiles.length
                    ? `${selectedFiles.length} arquivo(s) selecionado(s)`
                    : "Selecione as imagens da cidade"}
                </strong>
                <span>
                  {`Envie JPG, PNG ou WebP com até ${MAX_IMAGE_UPLOAD_SIZE_LABEL} por arquivo e ${MAX_BATCH_IMAGE_UPLOAD_SIZE_LABEL} por envio.`}
                </span>
              </div>
            </div>

            <div className="file-picker-actions">
              <button
                className="btn btn-secondary btn-with-icon file-picker-trigger"
                type="button"
                onClick={() => uploadInputRef.current?.click()}
              >
                <UploadIcon />
                <span>
                  {selectedFiles.length ? "Trocar seleção" : "Escolher imagens"}
                </span>
              </button>
              {selectedFiles.length ? (
                <button
                  className="file-picker-clear"
                  type="button"
                  onClick={clearSelectedFiles}
                >
                  Limpar seleção
                </button>
              ) : null}
            </div>
          </div>

          {selectedFiles.length ? (
            <div className="communication-files-list">
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="communication-file-item">
                  <div className="communication-file-copy">
                    <strong>{file.name}</strong>
                    <span>{formatFileSize(file.size)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {imagesError ? (
            <div className="inline-feedback error">{imagesError}</div>
          ) : null}

          <div className="user-form-actions">
            <button
              className="btn btn-primary btn-with-icon"
              type="button"
              disabled={isUploadingImages}
              onClick={() => void handleUploadImages()}
            >
              <UploadIcon />
              <span>
                {isUploadingImages ? "Enviando imagens..." : "Enviar imagens"}
              </span>
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal
        open={Boolean(modal)}
        title={
          modal?.type === "confirm-delete-city"
            ? "Excluir cidade?"
            : modal?.type === "confirm-delete-photographer"
              ? "Excluir fotógrafo?"
              : modal?.type === "confirm-delete-image"
                ? "Excluir imagem?"
                : errorModal?.title || ""
        }
        description={
          modal?.type === "confirm-delete-city"
            ? `A cidade "${modal.city.fullName}" e todo o acervo vinculado a ela serão removidos.`
            : modal?.type === "confirm-delete-photographer"
              ? `O fotógrafo "${modal.photographer.name}" e todas as imagens dele serão removidos desta cidade.`
              : modal?.type === "confirm-delete-image"
                ? `A imagem "${modal.image.fileName || modal.image.id}" será removida deste acervo.`
                : errorModal?.message || ""
        }
        variant={modal && modal.type !== "error" ? "danger" : "warning"}
        icon={modal && modal.type !== "error" ? <TrashIcon /> : <NoticeIcon />}
        onClose={() => {
          if (deleteActionId) return;
          setModal(null);
        }}
        secondaryAction={{
          label: modal && modal.type !== "error" ? "Cancelar" : "Fechar",
          onClick: () => setModal(null),
          disabled: Boolean(deleteActionId),
        }}
        primaryAction={
          modal && modal.type !== "error"
            ? {
                label: deleteActionId ? "Excluindo..." : "Confirmar exclusão",
                onClick: handleConfirmDelete,
                tone: "danger",
                icon: <TrashIcon />,
                disabled: Boolean(deleteActionId),
              }
            : undefined
        }
      />
    </AppLayout>
  );
}
