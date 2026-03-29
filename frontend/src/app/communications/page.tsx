"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/layout/app-modal";
import { AppLayout } from "@/components/layout/app-layout";
import { NoticeIcon } from "@/components/layout/notice-icon";
import { PageTitleCard } from "@/components/layout/page-title";
import { communicationsPage } from "@/components/layout/page-registry";
import { PlusIcon } from "@/components/layout/plus-icon";
import { useRouteTransition } from "@/components/transition/route-transition-provider";
import { useAuthGuard } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/lib/api-error";
import { resolveAssetUrl as buildImageSource } from "@/lib/app-urls";
import { subscribeToAppRefresh } from "@/lib/app-refresh";
import {
  getCityLibraryCity,
  listCityLibraryCities,
} from "@/services/city-library.service";
import {
  assignCommunicationImages,
  createCommunication,
} from "@/services/communications.service";
import { listGazinLibraryImages } from "@/services/gazin-library.service";
import { syncCommunicationGazinImages } from "@/services/project-gazin-images.service";
import type {
  CityLibraryCityDetails,
  CityLibraryCityListItem,
} from "@/types/city-library";
import type { CreateCommunicationPayload } from "@/types/communication";

type Step = 1 | 2 | 3 | 4;
type FrameDraft = { id: string; widthM: string; heightM: string };
type WallDraft = { id: string; name: string; frames: FrameDraft[] };

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
}

function createFrame(): FrameDraft {
  return { id: createId(), widthM: "", heightM: "" };
}

function createWall(index: number): WallDraft {
  return { id: createId(), name: `Parede ${index + 1}`, frames: [createFrame()] };
}

function parsePositive(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

export default function CommunicationsPage() {
  const router = useRouter();
  const { isReady } = useAuthGuard();
  const { startRouteTransition } = useRouteTransition();

  const [step, setStep] = useState<Step>(1);
  const [storeName, setStoreName] = useState("");
  const [selectedCityId, setSelectedCityId] = useState("");
  const [cities, setCities] = useState<CityLibraryCityListItem[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityLibraryCityDetails | null>(
    null,
  );
  const [citiesError, setCitiesError] = useState("");
  const [selectedCityError, setSelectedCityError] = useState("");
  const [isLoadingCities, setIsLoadingCities] = useState(true);
  const [isLoadingSelectedCity, setIsLoadingSelectedCity] = useState(false);
  const [walls, setWalls] = useState<WallDraft[]>([createWall(0)]);
  const [useSharedHeight, setUseSharedHeight] = useState(true);
  const [sharedHeight, setSharedHeight] = useState("");
  const [activeGazinCount, setActiveGazinCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState<{
    title: string;
    description: string;
    primaryLabel?: string;
    onPrimary?: () => void;
  } | null>(null);

  const loadBaseData = useCallback(async () => {
    try {
      setCitiesError("");
      setIsLoadingCities(true);

      const [citiesResponse, gazinResponse] = await Promise.all([
        listCityLibraryCities({
          page: 1,
          limit: 200,
        }),
        listGazinLibraryImages({
          status: "ACTIVE",
          page: 1,
          limit: 1,
        }),
      ]);

      setCities(citiesResponse.items);
      setActiveGazinCount(gazinResponse.meta.total);

      setSelectedCityId((current) => {
        if (current && citiesResponse.items.some((city) => city.id === current)) {
          return current;
        }

        return "";
      });
    } catch {
      setCitiesError(
        "Não foi possível carregar as cidades cadastradas e a biblioteca da Gazin.",
      );
      setCities([]);
      setActiveGazinCount(0);
    } finally {
      setIsLoadingCities(false);
    }
  }, []);

  useEffect(
    () =>
      subscribeToAppRefresh(() => {
        void loadBaseData();
      }),
    [loadBaseData],
  );

  useEffect(() => {
    if (!isReady) return;
    void loadBaseData();
  }, [isReady, loadBaseData]);

  useEffect(() => {
    if (!isReady) return;

    if (!selectedCityId) {
      setSelectedCity(null);
      setSelectedCityError("");
      return;
    }

    let cancelled = false;

    async function loadSelectedCity() {
      setIsLoadingSelectedCity(true);
      setSelectedCityError("");

      try {
        const response = await getCityLibraryCity(selectedCityId);

        if (!cancelled) {
          setSelectedCity(response);
        }
      } catch {
        if (!cancelled) {
          setSelectedCity(null);
          setSelectedCityError(
            "Não foi possível carregar os fotógrafos e as imagens desta cidade.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSelectedCity(false);
        }
      }
    }

    void loadSelectedCity();

    return () => {
      cancelled = true;
    };
  }, [isReady, selectedCityId]);

  const totalFrames = useMemo(
    () => walls.reduce((total, wall) => total + wall.frames.length, 0),
    [walls],
  );
  const totalCityImages = selectedCity?.imagesCount ?? 0;
  const totalPhotographers = selectedCity?.photographersCount ?? 0;
  const missingCityImages = Math.max(0, totalFrames - totalCityImages);
  const missingGazinImages = Math.max(0, totalFrames - activeGazinCount);
  const planningAvailabilityMessages = useMemo(() => {
    const messages: string[] = [];

    if (missingGazinImages > 0) {
      messages.push(
        `Faltam ${missingGazinImages} imagem(ns) da Gazin para os ${totalFrames} quadro(s) planejados.`,
      );
    }

    if (selectedCity && missingCityImages > 0) {
      messages.push(
        `Faltam ${missingCityImages} imagem(ns) da cidade para os ${totalFrames} quadro(s) planejados.`,
      );
    }

    return messages;
  }, [missingCityImages, missingGazinImages, selectedCity, totalFrames]);

  function updateWallsCount(nextCount: number) {
    const count = Math.max(1, nextCount);
    setWalls((current) => {
      if (count < current.length) return current.slice(0, count);
      if (count === current.length) return current;
      return [
        ...current,
        ...Array.from({ length: count - current.length }, (_, index) =>
          createWall(current.length + index),
        ),
      ];
    });
  }

  function updateWall(wallId: string, value: string) {
    setWalls((current) =>
      current.map((wall) => (wall.id === wallId ? { ...wall, name: value } : wall)),
    );
  }

  function updateFrameCount(wallId: string, nextCount: number) {
    const count = Math.max(1, nextCount);
    setWalls((current) =>
      current.map((wall) => {
        if (wall.id !== wallId) return wall;
        if (count < wall.frames.length) {
          return { ...wall, frames: wall.frames.slice(0, count) };
        }
        if (count === wall.frames.length) return wall;
        return {
          ...wall,
          frames: [
            ...wall.frames,
            ...Array.from({ length: count - wall.frames.length }, () =>
              createFrame(),
            ),
          ],
        };
      }),
    );
  }

  function updateFrameValue(
    wallId: string,
    frameId: string,
    field: "widthM" | "heightM",
    value: string,
  ) {
    setWalls((current) =>
      current.map((wall) =>
        wall.id === wallId
          ? {
              ...wall,
              frames: wall.frames.map((frame) =>
                frame.id === frameId ? { ...frame, [field]: value } : frame,
              ),
            }
          : wall,
      ),
    );
  }

  function validateCurrentStep(targetStep: Step) {
    if (targetStep === 1) {
      if (!storeName.trim()) {
        return "Preencha o nome da loja para continuar.";
      }

      if (!selectedCityId) {
        return "Selecione a cidade cadastrada para continuar.";
      }
    }

    if (targetStep === 2) {
      if (useSharedHeight && !parsePositive(sharedHeight)) {
        return "Informe a altura padrão dos quadros.";
      }

      for (const wall of walls) {
        if (!wall.name.trim()) {
          return "Preencha o nome de todas as paredes.";
        }

        for (const frame of wall.frames) {
          if (!parsePositive(frame.widthM)) {
            return "Informe larguras válidas para todos os quadros.";
          }

          if (!useSharedHeight && !parsePositive(frame.heightM)) {
            return "Informe alturas válidas para todos os quadros.";
          }
        }
      }
    }

    if (targetStep === 3) {
      if (!selectedCity) {
        return "Selecione uma cidade com acervo disponível para continuar.";
      }

      if (totalCityImages < totalFrames) {
        return `Faltam ${totalFrames - totalCityImages} imagem(ns) da cidade para bater com os quadros.`;
      }
    }

    if (targetStep === 4) {
      if (!selectedCity) {
        return "Selecione uma cidade cadastrada para continuar.";
      }

      if (missingCityImages > 0) {
        return `Faltam ${missingCityImages} imagem(ns) da cidade para criar os quadros.`;
      }

      if (missingGazinImages > 0) {
        return `Faltam ${missingGazinImages} imagem(ns) ativas da Gazin para completar os quadros.`;
      }
    }

    return null;
  }

  function buildPayload(): CreateCommunicationPayload {
    const shared = parsePositive(sharedHeight) ?? 0;

    return {
      storeName: storeName.trim(),
      cityLibraryId: selectedCityId,
      walls: walls.map((wall, wallIndex) => ({
        name: wall.name.trim() || `Parede ${wallIndex + 1}`,
        order: wallIndex + 1,
        frames: wall.frames.map((frame, frameIndex) => ({
          name: `Quadro ${frameIndex + 1}`,
          order: frameIndex + 1,
          widthM: parsePositive(frame.widthM) ?? 0,
          heightM: useSharedHeight ? shared : (parsePositive(frame.heightM) ?? 0),
        })),
      })),
    };
  }

  async function handleCreate() {
    const message = validateCurrentStep(4);
    if (message) {
      setModal({ title: "Ajuste os dados antes de criar", description: message });
      return;
    }

    setIsSubmitting(true);
    let communicationId: string | null = null;

    try {
      const communication = await createCommunication(buildPayload());
      communicationId = communication.id;
      await syncCommunicationGazinImages(communication.id);
      await assignCommunicationImages(communication.id);
      startRouteTransition({ label: "Abrindo os quadros", minDuration: 800 });
      router.push(`/communications/${communication.id}`);
    } catch (error) {
      const description = getApiErrorMessage(
        error,
        "Não foi possível criar a comunicação visual.",
      );
      setModal(
        communicationId
          ? {
              title: "Comunicação criada com pendência",
              description: `${description} Você pode abrir a comunicação e concluir os ajustes por lá.`,
              primaryLabel: "Abrir comunicação",
              onPrimary: () => router.push(`/communications/${communicationId}`),
            }
          : { title: "Não foi possível criar os quadros", description },
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isReady) return null;

  return (
    <AppLayout>
      <PageTitleCard
        page={communicationsPage}
        description="Monte a comunicação visual em etapas usando a cidade cadastrada e as imagens já organizadas por fotógrafo."
      />

      <section className="communications-flow-panel panel panel-large">
        <div className="wizard-stepper">
          {["Loja", "Paredes", "Acervo", "Revisão"].map((label, index) => (
            <div
              key={label}
              className={`wizard-step ${
                step === index + 1
                  ? "is-active"
                  : step > index + 1
                    ? "is-completed"
                    : ""
              }`}
            >
              <span className="wizard-step-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="wizard-step-copy">
                <strong>{label}</strong>
              </div>
            </div>
          ))}
        </div>

        {step === 1 ? (
          <div className="communications-step-stack">
            <div className="communications-step-grid">
              <label className="field-stack">
                <span>Nome da loja</span>
                <input
                  value={storeName}
                  onChange={(event) => setStoreName(event.target.value)}
                  placeholder="Filial 000"
                />
              </label>

              <label className="field-stack">
                <span>Cidade cadastrada</span>
                <select
                  className="app-select"
                  value={selectedCityId}
                  onChange={(event) => setSelectedCityId(event.target.value)}
                  disabled={isLoadingCities}
                >
                  <option value="">
                    {isLoadingCities
                      ? "Carregando cidades..."
                      : "Selecione a cidade"}
                  </option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.fullName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {citiesError ? (
              <div className="inline-feedback error">{citiesError}</div>
            ) : null}

            {selectedCityError ? (
              <div className="inline-feedback error">{selectedCityError}</div>
            ) : null}

            {selectedCity ? (
              <div className="communication-review-grid">
                <article className="communication-review-card">
                  <span>Cidade selecionada</span>
                  <strong>{selectedCity.fullName}</strong>
                </article>
                <article className="communication-review-card">
                  <span>Fotógrafos</span>
                  <strong>{totalPhotographers}</strong>
                </article>
                <article className="communication-review-card">
                  <span>Imagens da cidade</span>
                  <strong>{totalCityImages}</strong>
                </article>
                <article className="communication-review-card">
                  <span>Imagens ativas da Gazin</span>
                  <strong>{activeGazinCount}</strong>
                </article>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="communications-step-stack">
            <div className="communications-step-controls">
              <label className="field-stack communications-counter-field">
                <span>Quantidade de paredes</span>
                <input
                  type="number"
                  min={1}
                  value={walls.length}
                  onChange={(event) =>
                    updateWallsCount(Number(event.target.value) || 1)
                  }
                />
              </label>

              <label className="communications-checkbox-card">
                <input
                  type="checkbox"
                  checked={useSharedHeight}
                  onChange={(event) => setUseSharedHeight(event.target.checked)}
                />
                <div>
                  <strong>Usar altura padrão para todos os quadros</strong>
                </div>
              </label>

              {useSharedHeight ? (
                <label className="field-stack communications-counter-field">
                  <span>Altura padrão (m)</span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={sharedHeight}
                    onChange={(event) => setSharedHeight(event.target.value)}
                  />
                </label>
              ) : null}
            </div>

            {selectedCityError ? (
              <div className="inline-feedback error">{selectedCityError}</div>
            ) : isLoadingSelectedCity && selectedCityId ? (
              <div className="inline-feedback">
                Carregando o acervo da cidade selecionada...
              </div>
            ) : planningAvailabilityMessages.length > 0 ? (
              <div className="inline-feedback error">
                {planningAvailabilityMessages.join(" ")}
              </div>
            ) : (
              <div className="inline-feedback success">
                A biblioteca da Gazin e o acervo da cidade atendem a quantidade
                atual de quadros.
              </div>
            )}

            <div className="communications-walls-grid">
              {walls.map((wall) => (
                <article key={wall.id} className="communication-wall-card">
                  <div className="communication-wall-card-header">
                    <label className="field-stack">
                      <span>Nome da parede</span>
                      <input
                        value={wall.name}
                        onChange={(event) => updateWall(wall.id, event.target.value)}
                      />
                    </label>

                    <label className="field-stack communications-counter-field">
                      <span>Quadros nesta parede</span>
                      <input
                        type="number"
                        min={1}
                        value={wall.frames.length}
                        onChange={(event) =>
                          updateFrameCount(wall.id, Number(event.target.value) || 1)
                        }
                      />
                    </label>
                  </div>

                  <div className="communication-frame-config-grid">
                    {wall.frames.map((frame, index) => (
                      <div key={frame.id} className="communication-frame-config-card">
                        <strong>Quadro {index + 1}</strong>

                        <label className="field-stack">
                          <span>Largura (m)</span>
                          <input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={frame.widthM}
                            onChange={(event) =>
                              updateFrameValue(
                                wall.id,
                                frame.id,
                                "widthM",
                                event.target.value,
                              )
                            }
                          />
                        </label>

                        {!useSharedHeight ? (
                          <label className="field-stack">
                            <span>Altura (m)</span>
                            <input
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={frame.heightM}
                              onChange={(event) =>
                                updateFrameValue(
                                  wall.id,
                                  frame.id,
                                  "heightM",
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="communications-step-stack">
            {isLoadingSelectedCity ? (
              <div className="inline-feedback">Carregando acervo da cidade...</div>
            ) : null}

            {!isLoadingSelectedCity && !selectedCity ? (
              <div className="inline-feedback error">
                Selecione uma cidade cadastrada para visualizar fotógrafos e
                imagens.
              </div>
            ) : null}

            {selectedCity ? (
              <>
                {missingCityImages > 0 ? (
                  <div className="inline-feedback error">
                    Faltam {missingCityImages} imagem(ns) da cidade para bater com os{" "}
                    {totalFrames} quadro(s).
                  </div>
                ) : (
                  <div className="inline-feedback success">
                    O acervo da cidade já atende a quantidade atual de quadros.
                  </div>
                )}

                <div className="communication-review-grid">
                  <article className="communication-review-card">
                    <span>Cidade</span>
                    <strong>{selectedCity.fullName}</strong>
                  </article>
                  <article className="communication-review-card">
                    <span>Fotógrafos cadastrados</span>
                    <strong>{totalPhotographers}</strong>
                  </article>
                  <article className="communication-review-card">
                    <span>Total de imagens da cidade</span>
                    <strong>{totalCityImages}</strong>
                  </article>
                  <article className="communication-review-card">
                    <span>Quadros planejados</span>
                    <strong>{totalFrames}</strong>
                  </article>
                </div>

                <div className="city-library-photographer-grid">
                  {selectedCity.photographers.map((photographer) => (
                    <article
                      key={photographer.id}
                      className="city-library-photographer-card"
                    >
                      <div className="city-library-photographer-card-header">
                        <div>
                          <strong>{photographer.name}</strong>
                          <span>{photographer.images.length} imagem(ns)</span>
                        </div>
                      </div>

                      <div className="city-library-preview-strip">
                        {photographer.images.slice(0, 4).map((image) => (
                          <span key={image.id} className="city-library-preview-thumb">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={buildImageSource(image.imageUrl)}
                              alt={image.fileName || photographer.name}
                            />
                          </span>
                        ))}

                        {!photographer.images.length ? (
                          <div className="city-library-empty">
                            Este fotógrafo ainda não tem imagens cadastradas.
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="communications-step-stack">
            <div className="communication-review-grid">
              <article className="communication-review-card">
                <span>Loja</span>
                <strong>{storeName || "-"}</strong>
              </article>
              <article className="communication-review-card">
                <span>Cidade</span>
                <strong>{selectedCity?.fullName || "-"}</strong>
              </article>
              <article className="communication-review-card">
                <span>Paredes</span>
                <strong>{walls.length}</strong>
              </article>
              <article className="communication-review-card">
                <span>Quadros</span>
                <strong>{totalFrames}</strong>
              </article>
              <article className="communication-review-card">
                <span>Fotógrafos</span>
                <strong>{totalPhotographers}</strong>
              </article>
              <article className="communication-review-card">
                <span>Imagens da cidade</span>
                <strong>{totalCityImages}</strong>
              </article>
              <article className="communication-review-card">
                <span>Imagens da Gazin</span>
                <strong>{activeGazinCount}</strong>
              </article>
            </div>
          </div>
        ) : null}

        <div className="communications-wizard-actions">
          <button
            className="btn btn-secondary"
            type="button"
            disabled={step === 1 || isSubmitting}
            onClick={() =>
              setStep((current) => Math.max(1, current - 1) as Step)
            }
          >
            Voltar
          </button>

          {step < 4 ? (
            <button
              className="btn btn-primary btn-with-icon"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                const message = validateCurrentStep(step);

                if (message) {
                  setModal({
                    title: "Ajuste os dados desta etapa",
                    description: message,
                  });
                  return;
                }

                setStep((current) => Math.min(4, current + 1) as Step);
              }}
            >
              <PlusIcon />
              <span>Avançar etapa</span>
            </button>
          ) : (
            <button
              className="btn btn-primary btn-with-icon"
              type="button"
              disabled={isSubmitting}
              onClick={handleCreate}
            >
              <PlusIcon />
              <span>{isSubmitting ? "Criando quadros..." : "Criar quadros"}</span>
            </button>
          )}
        </div>
      </section>

      <AppModal
        open={Boolean(modal)}
        title={modal?.title || ""}
        description={modal?.description || ""}
        icon={<NoticeIcon />}
        onClose={() => setModal(null)}
        secondaryAction={{
          label: modal?.primaryLabel ? "Fechar" : "Entendi",
          onClick: () => setModal(null),
          disabled: isSubmitting,
        }}
        primaryAction={
          modal?.primaryLabel && modal.onPrimary
            ? {
                label: modal.primaryLabel,
                onClick: modal.onPrimary,
                tone: "primary",
                disabled: isSubmitting,
              }
            : undefined
        }
      />
    </AppLayout>
  );
}
