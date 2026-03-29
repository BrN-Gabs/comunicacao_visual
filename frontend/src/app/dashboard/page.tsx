"use client";

import { useEffect, useState } from "react";
import { AppModal } from "@/components/layout/app-modal";
import { AppLayout } from "@/components/layout/app-layout";
import { PageTitleCard } from "@/components/layout/page-title";
import { dashboardPage } from "@/components/layout/page-registry";
import { SearchIcon } from "@/components/layout/search-icon";
import { TrashIcon } from "@/components/layout/trash-icon";
import { TransitionLink } from "@/components/transition/transition-link";
import { useAuthGuard } from "@/hooks/use-auth";
import { getStoredUser } from "@/lib/auth";
import { subscribeToAppRefresh } from "@/lib/app-refresh";
import {
  deleteCommunication,
  listCommunications,
} from "@/services/communications.service";
import {
  clearDashboardRecentExports,
  getDashboardRecentExports,
  getDashboardStatusByUser,
} from "@/services/dashboard.service";
import type {
  CommunicationListItem,
  CommunicationStatus,
} from "@/types/communication";
import type {
  DashboardRecentExport,
  DashboardUserStatus,
} from "@/types/dashboard";

const statusMap: Record<
  CommunicationStatus,
  { label: string; className: string }
> = {
  IN_PROGRESS: {
    label: "Em andamento",
    className: "badge-warning",
  },
  FINALIZED: {
    label: "Finalizada",
    className: "badge-info",
  },
  DIVERGENT: {
    label: "Divergente",
    className: "badge-danger",
  },
  VALIDATED: {
    label: "Validada",
    className: "badge-success",
  },
};

function formatCommunicationId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function formatExportType(action: string) {
  switch (action) {
    case "EXPORT_FRAME_JPG":
      return "Quadro JPG";
    case "EXPORT_FRAME_PDF":
      return "Quadro PDF";
    case "EXPORT_COMMUNICATION_JPG_ZIP":
      return "Comunicacao JPG (ZIP)";
    case "EXPORT_COMMUNICATION_PDF":
      return "Comunicacao PDF";
    case "EXPORT_COMMUNICATION_PDF_ZIP":
      return "Comunicacao PDF (ZIP)";
    default:
      return action;
  }
}

function formatExportDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatExportReference(item: DashboardRecentExport) {
  return item.entityLabel || item.description;
}

type DashboardModalState =
  | {
      type: "confirm-delete";
      communication: CommunicationListItem;
    }
  | {
      type: "confirm-clear-exports";
      exportsCount: number;
    }
  | {
      type: "error";
      title: string;
      message: string;
    }
  | null;

export default function DashboardPage() {
  const { isReady } = useAuthGuard();
  const storedUser = getStoredUser();
  const currentUserRole = storedUser.role ?? null;
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [searchVersion, setSearchVersion] = useState(0);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [communications, setCommunications] = useState<CommunicationListItem[]>(
    [],
  );
  const [isLoadingCommunications, setIsLoadingCommunications] = useState(true);
  const [communicationsError, setCommunicationsError] = useState("");
  const [userStatus, setUserStatus] = useState<DashboardUserStatus[]>([]);
  const [isLoadingUserStatus, setIsLoadingUserStatus] = useState(true);
  const [userStatusError, setUserStatusError] = useState("");
  const [recentExports, setRecentExports] = useState<DashboardRecentExport[]>([]);
  const [isLoadingRecentExports, setIsLoadingRecentExports] = useState(true);
  const [recentExportsError, setRecentExportsError] = useState("");
  const [isClearingRecentExports, setIsClearingRecentExports] = useState(false);
  const [deleteActionCommunicationId, setDeleteActionCommunicationId] = useState<
    string | null
  >(null);
  const [dashboardModal, setDashboardModal] = useState<DashboardModalState>(null);

  useEffect(() => {
    return subscribeToAppRefresh(() => {
      setRefreshVersion((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let isActive = true;

    async function loadCommunications() {
      setIsLoadingCommunications(true);
      setCommunicationsError("");

      try {
        const response = await listCommunications({
          search: appliedSearch || undefined,
          page: 1,
          limit: 20,
        });

        if (!isActive) {
          return;
        }

        setCommunications(response.items);
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message =
          (
            error as {
              response?: { data?: { message?: string } };
            }
          ).response?.data?.message ||
          "Não foi possível carregar as comunicações visuais.";

        setCommunicationsError(message);
      } finally {
        if (isActive) {
          setIsLoadingCommunications(false);
        }
      }
    }

    void loadCommunications();

    return () => {
      isActive = false;
    };
  }, [isReady, appliedSearch, searchVersion, refreshVersion]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let isActive = true;

    async function loadUserStatus() {
      setIsLoadingUserStatus(true);
      setUserStatusError("");

      try {
        const response = await getDashboardStatusByUser();

        if (!isActive) {
          return;
        }

        setUserStatus(response.userStatus);
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message =
          (
            error as {
              response?: { data?: { message?: string } };
            }
          ).response?.data?.message ||
          "Não foi possível carregar o resumo por usuário.";

        setUserStatusError(message);
      } finally {
        if (isActive) {
          setIsLoadingUserStatus(false);
        }
      }
    }

    void loadUserStatus();

    return () => {
      isActive = false;
    };
  }, [isReady, refreshVersion]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let isActive = true;

    async function loadRecentExports() {
      setIsLoadingRecentExports(true);
      setRecentExportsError("");

      try {
        const response = await getDashboardRecentExports();

        if (!isActive) {
          return;
        }

        setRecentExports(response.recentExports);
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message =
          (
            error as {
              response?: { data?: { message?: string } };
            }
          ).response?.data?.message ||
          "Nao foi possivel carregar as exportacoes recentes.";

        setRecentExportsError(message);
      } finally {
        if (isActive) {
          setIsLoadingRecentExports(false);
        }
      }
    }

    void loadRecentExports();

    return () => {
      isActive = false;
    };
  }, [isReady, refreshVersion]);

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchTerm.trim());
    setSearchVersion((current) => current + 1);
  }

  function openDashboardErrorModal(title: string, message: string) {
    setDashboardModal({
      type: "error",
      title,
      message,
    });
  }

  function closeDashboardModal() {
    if (deleteActionCommunicationId || isClearingRecentExports) {
      return;
    }

    setDashboardModal(null);
  }

  function handleDeleteCommunication(item: CommunicationListItem) {
    setDashboardModal({
      type: "confirm-delete",
      communication: item,
    });
  }

  async function handleConfirmDeleteCommunication() {
    if (!dashboardModal || dashboardModal.type !== "confirm-delete") {
      return;
    }

    const { communication } = dashboardModal;

    setDeleteActionCommunicationId(communication.id);

    try {
      await deleteCommunication(communication.id);
      setDashboardModal(null);
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      const message =
        (
          error as {
            response?: { data?: { message?: string } };
          }
        ).response?.data?.message ||
        "Nao foi possivel excluir a comunicacao visual.";

      openDashboardErrorModal(
        "Nao foi possivel excluir a comunicacao",
        message,
      );
    } finally {
      setDeleteActionCommunicationId(null);
    }
  }

  function handleClearRecentExports() {
    setDashboardModal({
      type: "confirm-clear-exports",
      exportsCount: recentExports.length,
    });
  }

  async function handleConfirmClearRecentExports() {
    if (!dashboardModal || dashboardModal.type !== "confirm-clear-exports") {
      return;
    }

    setIsClearingRecentExports(true);

    try {
      await clearDashboardRecentExports();
      setDashboardModal(null);
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      const message =
        (
          error as {
            response?: { data?: { message?: string } };
          }
        ).response?.data?.message ||
        "Nao foi possivel limpar as exportacoes recentes.";

      openDashboardErrorModal(
        "Nao foi possivel limpar as exportacoes",
        message,
      );
    } finally {
      setIsClearingRecentExports(false);
    }
  }

  if (!isReady) {
    return null;
  }

  const deleteModal =
    dashboardModal?.type === "confirm-delete" ? dashboardModal : null;
  const clearExportsModal =
    dashboardModal?.type === "confirm-clear-exports" ? dashboardModal : null;
  const errorModal = dashboardModal?.type === "error" ? dashboardModal : null;
  const isDeleteModalOpen = Boolean(deleteModal);
  const isClearExportsModalOpen = Boolean(clearExportsModal);

  return (
    <AppLayout>
      <PageTitleCard
        page={dashboardPage}
        description="Tela principal operacional com foco em leitura rápida e acesso as comunicações visuais."
        actions={
          <form className="page-search" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar comunicações visuais"
              className="page-search-input"
              aria-label="Pesquisar comunicações visuais"
            />
            <button
              className="btn btn-secondary btn-icon"
              type="submit"
              aria-label="Pesquisar"
              title="Pesquisar"
            >
              <SearchIcon />
            </button>
          </form>
        }
      />

      <section className="dashboard-grid">
        <div className="panel panel-large">
          <div className="panel-header">
            <div>
              <h3>Comunicações visuais em andamento</h3>
              <p>Lista de retorno operacional com prioridade rápida.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Filial</th>
                  <th>Cidade</th>
                  <th>Status</th>
                  <th>Criado por</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingCommunications ? (
                  <tr>
                    <td className="table-feedback" colSpan={6}>
                      Carregando comunicações visuais...
                    </td>
                  </tr>
                ) : null}

                {!isLoadingCommunications && communicationsError ? (
                  <tr>
                    <td className="table-feedback error" colSpan={6}>
                      {communicationsError}
                    </td>
                  </tr>
                ) : null}

                {!isLoadingCommunications &&
                !communicationsError &&
                communications.length === 0 ? (
                  <tr>
                    <td className="table-feedback" colSpan={6}>
                      Nenhuma comunicação visual encontrada para a pesquisa atual.
                    </td>
                  </tr>
                ) : null}

                {!isLoadingCommunications &&
                  !communicationsError &&
                  communications.map((item) => {
                    const badge = statusMap[item.status];

                    return (
                      <tr key={item.id}>
                        <td>{formatCommunicationId(item.id)}</td>
                        <td>{item.storeName}</td>
                        <td>
                          {item.cityName} - {item.state}
                        </td>
                        <td>
                          <span className={`badge ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td>{item.createdBy?.name || "-"}</td>
                        <td>
                          <div className="table-action-row">
                            <TransitionLink
                              href={`/communications/${item.id}`}
                              loadingLabel="Abrindo detalhes da comunicação visual"
                              minDuration={720}
                              className="table-link"
                            >
                              Abrir
                            </TransitionLink>

                            {currentUserRole === "ADMIN" ? (
                              <button
                                className="table-action-button table-action-icon-button danger"
                                type="button"
                                onClick={() => handleDeleteCommunication(item)}
                                disabled={deleteActionCommunicationId === item.id}
                                aria-label={
                                  deleteActionCommunicationId === item.id
                                    ? `Excluindo comunicação ${item.fullName}`
                                    : `Excluir comunicação ${item.fullName}`
                                }
                                title={
                                  deleteActionCommunicationId === item.id
                                    ? "Excluindo comunicação"
                                    : `Excluir comunicação ${item.fullName}`
                                }
                              >
                                <TrashIcon />
                                <span className="sr-only">
                                  {deleteActionCommunicationId === item.id
                                    ? `Excluindo comunicação ${item.fullName}`
                                    : `Excluir comunicação ${item.fullName}`}
                                </span>
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header panel-header-inline">
            <div>
              <h3>Status por usuário</h3>
              <p>Resumo com dados reais dos usuários ativos.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Finalizadas</th>
                  <th>Abertas</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingUserStatus ? (
                  <tr>
                    <td className="table-feedback" colSpan={3}>
                      Carregando status por usuário...
                    </td>
                  </tr>
                ) : null}

                {!isLoadingUserStatus && userStatusError ? (
                  <tr>
                    <td className="table-feedback error" colSpan={3}>
                      {userStatusError}
                    </td>
                  </tr>
                ) : null}

                {!isLoadingUserStatus &&
                !userStatusError &&
                userStatus.length === 0 ? (
                  <tr>
                    <td className="table-feedback" colSpan={3}>
                      Nenhum usuário ativo encontrado.
                    </td>
                  </tr>
                ) : null}

                {!isLoadingUserStatus &&
                  !userStatusError &&
                  userStatus.map((item) => (
                    <tr key={item.userId}>
                      <td>{item.name}</td>
                      <td>{item.finalizedCount}</td>
                      <td>{item.openCount}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header panel-header-inline">
            <div>
              <h3>Exportações recentes</h3>
              <p>Últimos arquivos gerados no sistema.</p>
            </div>
            {currentUserRole === "ADMIN" ? (
              <button
                className="table-action-button table-action-icon-button danger"
                type="button"
                onClick={handleClearRecentExports}
                disabled={
                  isLoadingRecentExports ||
                  isClearingRecentExports ||
                  recentExports.length === 0
                }
                aria-label={
                  isClearingRecentExports
                    ? "Limpando exportacoes recentes"
                    : "Limpar exportacoes recentes"
                }
                title={
                  isClearingRecentExports
                    ? "Limpando exportacoes recentes"
                    : "Limpar exportacoes recentes"
                }
              >
                <TrashIcon />
                <span className="sr-only">
                  {isClearingRecentExports
                    ? "Limpando exportacoes recentes"
                    : "Limpar exportacoes recentes"}
                </span>
              </button>
            ) : null}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Referência</th>
                  <th>Usuário</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingRecentExports ? (
                  <tr>
                    <td className="table-feedback" colSpan={4}>
                      Carregando exportações recentes...
                    </td>
                  </tr>
                ) : null}

                {!isLoadingRecentExports && recentExportsError ? (
                  <tr>
                    <td className="table-feedback error" colSpan={4}>
                      {recentExportsError}
                    </td>
                  </tr>
                ) : null}

                {!isLoadingRecentExports &&
                !recentExportsError &&
                recentExports.length === 0 ? (
                  <tr>
                    <td className="table-feedback" colSpan={4}>
                      Sem registros ainda
                    </td>
                  </tr>
                ) : null}

                {!isLoadingRecentExports &&
                  !recentExportsError &&
                  recentExports.map((item) => (
                    <tr key={item.id}>
                      <td>{formatExportType(item.action)}</td>
                      <td>{formatExportReference(item)}</td>
                      <td>{item.user?.name || "Sistema"}</td>
                      <td>{formatExportDate(item.createdAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <AppModal
        open={isClearExportsModalOpen}
        title="Limpar exportacoes recentes?"
        description={`Os ${clearExportsModal?.exportsCount ?? 0} registro(s) recentes de exportacao serao removidos do dashboard.`}
        variant="danger"
        icon={<TrashIcon />}
        onClose={closeDashboardModal}
        secondaryAction={{
          label: "Cancelar",
          onClick: closeDashboardModal,
          disabled: isClearingRecentExports,
        }}
        primaryAction={{
          label: isClearingRecentExports ? "Limpando..." : "Confirmar limpeza",
          onClick: handleConfirmClearRecentExports,
          tone: "danger",
          icon: <TrashIcon />,
          disabled: isClearingRecentExports,
        }}
      />

      <AppModal
        open={Boolean(deleteModal || errorModal)}
        title={
          isDeleteModalOpen
            ? "Excluir comunicação visual?"
            : errorModal?.title || ""
        }
        description={
          isDeleteModalOpen
            ? `A comunicação "${deleteModal?.communication.fullName}" será removida permanentemente.`
            : errorModal?.message || ""
        }
        variant={isDeleteModalOpen ? "danger" : "warning"}
        icon={isDeleteModalOpen ? <TrashIcon /> : undefined}
        onClose={closeDashboardModal}
        secondaryAction={{
          label: isDeleteModalOpen ? "Cancelar" : "Fechar",
          onClick: closeDashboardModal,
          disabled: deleteActionCommunicationId !== null,
        }}
        primaryAction={
          isDeleteModalOpen
            ? {
                label:
                  deleteActionCommunicationId !== null
                    ? "Excluindo..."
                    : "Confirmar exclusao",
                onClick: handleConfirmDeleteCommunication,
                tone: "danger",
                icon: <TrashIcon />,
                disabled: deleteActionCommunicationId !== null,
              }
            : undefined
        }
      />
    </AppLayout>
  );
}
