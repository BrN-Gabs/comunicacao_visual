"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordVisibilityButton } from "@/components/forms/password-visibility-button";
import { AppModal } from "@/components/layout/app-modal";
import { AppLayout } from "@/components/layout/app-layout";
import { EditIcon } from "@/components/layout/edit-icon";
import { PageTitleCard } from "@/components/layout/page-title";
import { usersPage } from "@/components/layout/page-registry";
import { PlusIcon } from "@/components/layout/plus-icon";
import { SearchIcon } from "@/components/layout/search-icon";
import { StatusToggleIcon } from "@/components/layout/status-toggle-icon";
import { TrashIcon } from "@/components/layout/trash-icon";
import { useRouteTransition } from "@/components/transition/route-transition-provider";
import { useAuthGuard } from "@/hooks/use-auth";
import { getApiMessage } from "@/lib/api-error";
import { getStoredUser } from "@/lib/auth";
import { subscribeToAppRefresh } from "@/lib/app-refresh";
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  updateUserStatus,
} from "@/services/users.service";
import type {
  CreateUserPayload,
  ManagedUser,
  UpdateUserPayload,
  UserRole,
  UserStatus,
} from "@/types/user";

type UserFormState = {
  name: string;
  email: string;
  role: UserRole;
  password: string;
};

type UsersModalState =
  | {
      type: "confirm-status";
      user: ManagedUser;
      nextStatus: UserStatus;
    }
  | {
      type: "confirm-delete";
      user: ManagedUser;
    }
  | {
      type: "error";
      title: string;
      message: string;
    }
  | null;

const emptyForm: UserFormState = {
  name: "",
  email: "",
  role: "NORMAL",
  password: "",
};

const roleLabelMap: Record<UserRole, string> = {
  ADMIN: "Admin",
  VIP: "VIP",
  NORMAL: "Normal",
};

const statusLabelMap: Record<UserStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
};

const specialCharacterRegex = /[^A-Za-z0-9\s]/;

type PasswordStrength = "neutral" | "weak" | "medium" | "strong";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getPasswordFeedback(passwordValue: string) {
  const password = passwordValue.trim();
  const hasMinLength = password.length >= 6;
  const hasSpecialCharacter = specialCharacterRegex.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const isValid = hasMinLength && hasSpecialCharacter;

  if (!password) {
    return {
      hasMinLength,
      hasSpecialCharacter,
      isValid,
      label: "Aguardando",
      level: 0 as const,
      strength: "neutral" as PasswordStrength,
    };
  }

  if (!isValid) {
    return {
      hasMinLength,
      hasSpecialCharacter,
      isValid,
      label: "Fraca",
      level: 1 as const,
      strength: "weak" as PasswordStrength,
    };
  }

  const strongSignals =
    Number(hasLowercase) +
    Number(hasUppercase) +
    Number(hasNumber) +
    Number(password.length >= 8);

  if (strongSignals >= 4) {
    return {
      hasMinLength,
      hasSpecialCharacter,
      isValid,
      label: "Forte",
      level: 3 as const,
      strength: "strong" as PasswordStrength,
    };
  }

  return {
    hasMinLength,
    hasSpecialCharacter,
    isValid,
    label: "Media",
    level: 2 as const,
    strength: "medium" as PasswordStrength,
  };
}

function getRoleBadgeClass(role: UserRole) {
  if (role === "ADMIN") {
    return "badge-info";
  }

  if (role === "VIP") {
    return "badge-warning";
  }

  return "badge-neutral";
}

function getStatusBadgeClass(status: UserStatus) {
  return status === "ACTIVE" ? "badge-success" : "badge-neutral";
}

export default function UsersManagementPage() {
  const router = useRouter();
  const { isReady } = useAuthGuard();
  const { startRouteTransition } = useRouteTransition();

  const storedUser = getStoredUser();
  const currentUserId = storedUser.id ?? "";
  const currentUserRole = storedUser.role ?? null;

  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [roleFilter, setRoleFilter] = useState<"" | UserRole>("");
  const [statusFilter, setStatusFilter] = useState<"" | UserStatus>("");

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState("");

  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formValues, setFormValues] = useState<UserFormState>(emptyForm);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusActionUserId, setStatusActionUserId] = useState<string | null>(
    null,
  );
  const [deleteActionUserId, setDeleteActionUserId] = useState<string | null>(
    null,
  );
  const [usersModal, setUsersModal] = useState<UsersModalState>(null);
  const passwordFeedback = getPasswordFeedback(formValues.password);
  const shouldShowPasswordGuidance = formValues.password.trim().length > 0;

  useEffect(() => {
    return subscribeToAppRefresh(() => {
      setRefreshVersion((current) => current + 1);
    });
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isReady || currentUserRole !== "ADMIN") {
      return;
    }

    setIsLoadingUsers(true);
    setUsersError("");

    try {
      const response = await listUsers({
        search: appliedSearch || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page: 1,
        limit: 50,
      });

      setUsers(response.items);
    } catch (error) {
      setUsersError(
        getApiMessage(error, "Não foi possível carregar os usuários."),
      );
    } finally {
      setIsLoadingUsers(false);
    }
  }, [
    appliedSearch,
    currentUserRole,
    isReady,
    roleFilter,
    statusFilter,
  ]);

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
      return;
    }

    loadUsers();
  }, [
    currentUserRole,
    isReady,
    loadUsers,
    refreshVersion,
    router,
    startRouteTransition,
  ]);

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchTerm.trim());
  }

  function handleClearFilters() {
    setSearchTerm("");
    setAppliedSearch("");
    setRoleFilter("");
    setStatusFilter("");
  }

  function handleStartCreate() {
    setFormMode("create");
    setEditingUserId(null);
    setFormValues(emptyForm);
    setIsPasswordVisible(false);
    setFormError("");
    setFormSuccess("");
    setIsFormModalOpen(true);
  }

  function handleEditUser(user: ManagedUser) {
    setFormMode("edit");
    setEditingUserId(user.id);
    setFormValues({
      name: user.name,
      email: user.email,
      role: user.role,
      password: "",
    });
    setIsPasswordVisible(false);
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
    setIsPasswordVisible(false);
  }

  function updateStoredUser(user: ManagedUser) {
    const nextStoredUser = {
      ...storedUser,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    localStorage.setItem("user", JSON.stringify(nextStoredUser));
  }

  function openUsersErrorModal(title: string, message: string) {
    setUsersModal({
      type: "error",
      title,
      message,
    });
  }

  function closeUsersModal() {
    if (statusActionUserId || deleteActionUserId) {
      return;
    }

    setUsersModal(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError("");
    setFormSuccess("");

    const name = formValues.name.trim();
    const email = formValues.email.trim().toLowerCase();
    const password = formValues.password.trim();
    const currentPasswordFeedback = getPasswordFeedback(password);

    if (!name || !email) {
      setFormError("Preencha nome e e-mail para continuar.");
      setIsSubmitting(false);
      return;
    }

    if (!isValidEmail(email)) {
      setFormError("Informe um e-mail válido para continuar.");
      setIsSubmitting(false);
      return;
    }

    if (formMode === "create" && !password) {
      setFormError(
        "Informe uma senha com no mínimo 6 caracteres e 1 caractere especial.",
      );
      setIsSubmitting(false);
      return;
    }

    if (password && !currentPasswordFeedback.isValid) {
      setFormError(
        "A senha deve ter no mínimo 6 caracteres e pelo menos 1 caractere especial.",
      );
      setIsSubmitting(false);
      return;
    }

    try {
      const payload: UpdateUserPayload = {
        name,
        email,
        role: formValues.role,
      };

      if (password) {
        payload.password = password;
      }

      let savedUser: ManagedUser;

      if (formMode === "create") {
        savedUser = await createUser(payload as CreateUserPayload);
        setFormValues(emptyForm);
        setIsPasswordVisible(false);
        setFormSuccess("Usuário criado com sucesso.");
      } else {
        if (!editingUserId) {
          setFormError("Selecione um usuário para editar.");
          setIsSubmitting(false);
          return;
        }

        savedUser = await updateUser(editingUserId, payload);
        setFormSuccess("Usuário atualizado com sucesso.");
        setFormValues((current) => ({
          ...current,
          password: "",
        }));
        setIsPasswordVisible(false);

        if (savedUser.id === currentUserId) {
          updateStoredUser(savedUser);

          if (savedUser.role !== "ADMIN") {
            startRouteTransition({
              label: "Voltando ao dashboard",
              minDuration: 800,
            });
            router.replace("/dashboard");
            return;
          }
        }
      }

      await loadUsers();
      setIsFormModalOpen(false);
    } catch (error) {
      setFormError(
        getApiMessage(error, "Não foi possível salvar o usuário."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleStatus(user: ManagedUser) {
    const nextStatus: UserStatus =
      user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    setUsersModal({
      type: "confirm-status",
      user,
      nextStatus,
    });
  }

  async function handleConfirmStatusChange() {
    if (!usersModal || usersModal.type !== "confirm-status") {
      return;
    }

    const { user, nextStatus } = usersModal;

    setStatusActionUserId(user.id);
    setFormSuccess("");

    try {
      const updatedUser = await updateUserStatus(user.id, nextStatus);
      setUsersModal(null);

      if (updatedUser.id === currentUserId) {
        updateStoredUser(updatedUser);

        if (updatedUser.status === "INACTIVE") {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          startRouteTransition({
            label: "Encerrando sessão",
            minDuration: 850,
          });
          router.push("/login");
          return;
        }
      }

      setFormSuccess(
        nextStatus === "INACTIVE"
          ? "Usuário inativado com sucesso."
          : "Usuário reativado com sucesso.",
      );
      await loadUsers();
    } catch (error) {
      openUsersErrorModal(
        "Não foi possível atualizar o status",
        getApiMessage(error, "Não foi possível atualizar o status do usuário."),
      );
    } finally {
      setStatusActionUserId(null);
    }
  }

  function handleDeleteUser(user: ManagedUser) {
    setUsersModal({
      type: "confirm-delete",
      user,
    });
  }

  async function handleConfirmDeleteUser() {
    if (!usersModal || usersModal.type !== "confirm-delete") {
      return;
    }

    const { user } = usersModal;

    setDeleteActionUserId(user.id);
    setFormSuccess("");

    try {
      await deleteUser(user.id);
      setUsersModal(null);
      setFormSuccess("Usuário excluído com sucesso.");
      await loadUsers();
    } catch (error) {
      openUsersErrorModal(
        "Não foi possível excluir o usuário",
        getApiMessage(error, "Não foi possível excluir o usuário."),
      );
    } finally {
      setDeleteActionUserId(null);
    }
  }

  /* Legacy flow replaced by modal.
    const nextStatus: UserStatus =
      user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const actionLabel = nextStatus === "INACTIVE" ? "inativar" : "reativar";

    const confirmed = window.confirm(
      `Deseja ${actionLabel} o usuario ${user.name}?`,
    );

    if (!confirmed) {
      return;
    }

    setStatusActionUserId(user.id);
    setUsersError("");
    setFormSuccess("");

    try {
      const updatedUser = await updateUserStatus(user.id, nextStatus);

      if (updatedUser.id === currentUserId) {
        updateStoredUser(updatedUser);

        if (updatedUser.status === "INACTIVE") {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          startRouteTransition({
            label: "Encerrando sessÃ£o",
            minDuration: 850,
          });
          router.push("/login");
          return;
        }
      }

      setFormSuccess(
        nextStatus === "INACTIVE"
          ? "UsuÃ¡rio inativado com sucesso."
          : "UsuÃ¡rio reativado com sucesso.",
      );
      await loadUsers();
    } catch (error) {
      setUsersError(
        getApiMessage(error, "NÃ£o foi possÃ­vel atualizar o status do usuÃ¡rio."),
      );
    } finally {
      setStatusActionUserId(null);
    }
  */

  if (!isReady || currentUserRole !== "ADMIN") {
    return null;
  }

  const statusModal =
    usersModal?.type === "confirm-status" ? usersModal : null;
  const deleteModal =
    usersModal?.type === "confirm-delete" ? usersModal : null;
  const errorModal = usersModal?.type === "error" ? usersModal : null;
  const isStatusModalOpen = Boolean(statusModal);
  const isDeleteModalOpen = Boolean(deleteModal);
  const statusActionLabel =
    statusModal?.nextStatus === "INACTIVE" ? "inativação" : "reativação";
  const statusActionDescription = statusModal
    ? statusModal.nextStatus === "INACTIVE"
      ? statusModal.user.id === currentUserId
        ? `O usuário "${statusModal.user.name}" ficará sem acesso ao sistema por enquanto. Como esta é a sua conta atual, a sessão será encerrada logo após a confirmação.`
        : `O usuário "${statusModal.user.name}" ficará sem acesso ao sistema até ser reativado.`
      : `O usuário "${statusModal.user.name}" voltará a ter acesso ao sistema assim que a alteração for confirmada.`
    : "";
  const deleteActionDescription = deleteModal
    ? deleteModal.user.id === currentUserId
      ? `A conta "${deleteModal.user.name}" é a sua conta atual e não pode ser excluída por aqui.`
      : `O usuário "${deleteModal.user.name}" será removido permanentemente do sistema.`
    : "";

  return (
    <AppLayout>
      <PageTitleCard
        page={usersPage}
        description="Área administrativa para criação, edição e inativação de usuários da operação."
        actions={
          <div className="users-toolbar">
            <form className="page-search" onSubmit={handleSearchSubmit}>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pesquisar usuários"
                className="page-search-input"
                aria-label="Pesquisar usuários"
              />
              <button
                className="btn btn-secondary btn-icon"
                type="submit"
                aria-label="Pesquisar usuários"
                title="Pesquisar usuários"
              >
                <SearchIcon />
              </button>
            </form>

            <div className="users-filters">
              <select
                className="app-select"
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as "" | UserRole)
                }
                aria-label="Filtrar por perfil"
              >
                <option value="">Todos os perfis</option>
                <option value="ADMIN">Admin</option>
                <option value="VIP">VIP</option>
                <option value="NORMAL">Normal</option>
              </select>

              <select
                className="app-select"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "" | UserStatus)
                }
                aria-label="Filtrar por status"
              >
                <option value="">Todos os status</option>
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
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
              <h3>Usuários cadastrados</h3>
              <p>Gerencie perfis, status e dados de acesso da operação.</p>
            </div>

            <div className="panel-header-actions">
              <span className="user-list-meta">
                {users.length} usuario(s) carregado(s)
              </span>
              <button
                className="btn btn-primary btn-with-icon"
                type="button"
                onClick={handleStartCreate}
              >
                <PlusIcon />
                Novo usuário
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
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingUsers ? (
                  <tr>
                    <td className="table-feedback" colSpan={5}>
                      Carregando usuários...
                    </td>
                  </tr>
                ) : null}

                {!isLoadingUsers && usersError ? (
                  <tr>
                    <td className="table-feedback error" colSpan={5}>
                      {usersError}
                    </td>
                  </tr>
                ) : null}

                {!isLoadingUsers && !usersError && users.length === 0 ? (
                  <tr>
                    <td className="table-feedback" colSpan={5}>
                      Nenhum usuário encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : null}

                {!isLoadingUsers &&
                  !usersError &&
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="table-title-cell">
                          <strong>{user.name}</strong>
                          <span>
                            {new Date(user.createdAt).toLocaleDateString(
                              "pt-BR",
                            )}
                          </span>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`badge ${getRoleBadgeClass(user.role)}`}>
                          {roleLabelMap[user.role]}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${getStatusBadgeClass(user.status)}`}
                        >
                          {statusLabelMap[user.status]}
                        </span>
                      </td>
                      <td>
                        <div className="table-action-row">
                          <button
                            className="table-action-button table-action-icon-button"
                            type="button"
                            onClick={() => handleEditUser(user)}
                            aria-label={`Editar usuário ${user.name}`}
                            title={`Editar usuário ${user.name}`}
                          >
                            <EditIcon />
                            <span className="sr-only">
                              Editar usuário {user.name}
                            </span>
                          </button>
                          <button
                            className={`table-action-button table-action-icon-button ${
                              user.status === "ACTIVE" ? "danger" : "success"
                            }`}
                            type="button"
                            onClick={() => handleToggleStatus(user)}
                            disabled={statusActionUserId === user.id}
                            aria-label={
                              statusActionUserId === user.id
                                ? `Atualizando status do usuário ${user.name}`
                                : user.status === "ACTIVE"
                                  ? `Inativar usuário ${user.name}`
                                  : `Reativar usuário ${user.name}`
                            }
                            title={
                              statusActionUserId === user.id
                                ? "Atualizando status"
                                : user.status === "ACTIVE"
                                  ? "Inativar usuário"
                                  : "Reativar usuário"
                            }
                          >
                            <StatusToggleIcon />
                            <span className="sr-only">
                              {statusActionUserId === user.id
                                ? `Atualizando status do usuário ${user.name}`
                                : user.status === "ACTIVE"
                                  ? `Inativar usuário ${user.name}`
                                  : `Reativar usuário ${user.name}`}
                            </span>
                          </button>
                          <button
                            className="table-action-button table-action-icon-button danger"
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={
                              deleteActionUserId === user.id ||
                              user.id === currentUserId
                            }
                            aria-label={
                              user.id === currentUserId
                                ? `A conta ${user.name} não pode ser excluída`
                                : deleteActionUserId === user.id
                                  ? `Excluindo usuário ${user.name}`
                                  : `Excluir usuário ${user.name}`
                            }
                            title={
                              user.id === currentUserId
                                ? "Você não pode excluir sua própria conta"
                                : deleteActionUserId === user.id
                                  ? "Excluindo usuário"
                                  : `Excluir usuário ${user.name}`
                            }
                          >
                            <TrashIcon />
                            <span className="sr-only">
                              {user.id === currentUserId
                                ? `A conta ${user.name} não pode ser excluída`
                                : deleteActionUserId === user.id
                                  ? `Excluindo usuário ${user.name}`
                                  : `Excluir usuário ${user.name}`}
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
              <h3>{formMode === "create" ? "Novo usuário" : "Editar usuário"}</h3>
              <p>
                {formMode === "create"
                  ? "Cadastre um novo acesso para a operação."
                  : "Atualize dados, senha e perfil do usuário selecionado."}
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
            <div className="user-form-grid">
              <label className="field-stack">
                <span>Nome</span>
                <input
                  type="text"
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Nome completo"
                />
              </label>

              <label className="field-stack">
                <span>E-mail</span>
                <input
                  type="email"
                  value={formValues.email}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="usuario@gazin.com.br"
                />
              </label>

              <label className="field-stack">
                <span>Perfil</span>
                <select
                  value={formValues.role}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      role: event.target.value as UserRole,
                    }))
                  }
                >
                  <option value="ADMIN">Admin</option>
                  <option value="VIP">VIP</option>
                  <option value="NORMAL">Normal</option>
                </select>
              </label>

              <label className="field-stack">
                <span>
                  {formMode === "create"
                    ? "Senha inicial"
                    : "Nova senha (opcional)"}
                </span>
                <div className="field-with-action">
                  <input
                    type={isPasswordVisible ? "text" : "password"}
                    value={formValues.password}
                    autoComplete="new-password"
                    minLength={6}
                    aria-invalid={
                      passwordFeedback.level > 0 && !passwordFeedback.isValid
                    }
                    aria-describedby="user-password-help"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder={
                      formMode === "create"
                        ? "Mí­nimo de 6 caracteres e 1 especial"
                        : "Preencha so se quiser trocar"
                    }
                  />
                  <PasswordVisibilityButton
                    visible={isPasswordVisible}
                    onClick={() => setIsPasswordVisible((current) => !current)}
                    className="field-action-button"
                  />
                </div>

                <p className="field-help" id="user-password-help">
                  {formMode === "create"
                    ? "Use pelo menos 6 caracteres e 1 caractere especial."
                    : "Deixe em branco para manter a senha atual. Se preencher, use pelo menos 6 caracteres e 1 caractere especial."}
                </p>

                {shouldShowPasswordGuidance ? (
                  <div className="password-strength" aria-live="polite">
                    <div className="password-strength-header">
                      <span className="password-strength-caption">
                        Forca da senha
                      </span>
                      <strong
                        className={`password-strength-label is-${passwordFeedback.strength}`}
                      >
                        {passwordFeedback.label}
                      </strong>
                    </div>

                    <div className="password-strength-meter" aria-hidden="true">
                      {[1, 2, 3].map((level) => (
                        <span
                          key={level}
                          className={`password-strength-segment ${
                            passwordFeedback.level >= level ? "is-active" : ""
                          } is-${passwordFeedback.strength}`}
                        />
                      ))}
                    </div>

                    <div className="password-requirements">
                      <p
                        className={`password-requirement ${
                          passwordFeedback.hasMinLength ? "is-met" : ""
                        }`}
                      >
                        Mí­nimo de 6 caracteres
                      </p>
                      <p
                        className={`password-requirement ${
                          passwordFeedback.hasSpecialCharacter ? "is-met" : ""
                        }`}
                      >
                        1 caractere especial
                      </p>
                    </div>
                  </div>
                ) : null}
              </label>
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
                    ? "Criando..."
                    : "Salvando..."
                  : formMode === "create"
                    ? "Criar usuÃ¡rio"
                    : "Salvar alteraÃ§Ãµes"}
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
        title={formMode === "create" ? "Novo usuário" : "Editar usuário"}
        description={
          formMode === "create"
            ? "Cadastre um novo acesso para a operação."
            : "Atualize dados, senha e perfil do usuário selecionado."
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
          <div className="user-form-grid">
            <label className="field-stack">
              <span>Nome</span>
              <input
                type="text"
                value={formValues.name}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Nome completo"
              />
            </label>

            <label className="field-stack">
              <span>E-mail</span>
              <input
                type="email"
                value={formValues.email}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="usuario@gazin.com.br"
              />
            </label>

            <label className="field-stack">
              <span>Perfil</span>
              <select
                value={formValues.role}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    role: event.target.value as UserRole,
                  }))
                }
              >
                <option value="ADMIN">Admin</option>
                <option value="VIP">VIP</option>
                <option value="NORMAL">Normal</option>
              </select>
            </label>

            <label className="field-stack">
              <span>
                {formMode === "create"
                  ? "Senha inicial"
                  : "Nova senha (opcional)"}
              </span>
              <div className="field-with-action">
                <input
                  type={isPasswordVisible ? "text" : "password"}
                  value={formValues.password}
                  autoComplete="new-password"
                  minLength={6}
                  aria-invalid={
                    passwordFeedback.level > 0 && !passwordFeedback.isValid
                  }
                  aria-describedby="user-password-help-modal"
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder={
                    formMode === "create"
                      ? "Mínimo de 6 caracteres e 1 especial"
                      : "Preencha so se quiser trocar"
                  }
                />
                <PasswordVisibilityButton
                  visible={isPasswordVisible}
                  onClick={() => setIsPasswordVisible((current) => !current)}
                  className="field-action-button"
                />
              </div>

              <p className="field-help" id="user-password-help-modal">
                {formMode === "create"
                  ? "Use pelo menos 6 caracteres e 1 caractere especial."
                  : "Deixe em branco para manter a senha atual. Se preencher, use pelo menos 6 caracteres e 1 caractere especial."}
              </p>

              {shouldShowPasswordGuidance ? (
                <div className="password-strength" aria-live="polite">
                  <div className="password-strength-header">
                    <span className="password-strength-caption">
                      Força da senha
                    </span>
                    <strong
                      className={`password-strength-label is-${passwordFeedback.strength}`}
                    >
                      {passwordFeedback.label}
                    </strong>
                  </div>

                  <div className="password-strength-meter" aria-hidden="true">
                    {[1, 2, 3].map((level) => (
                      <span
                        key={level}
                        className={`password-strength-segment ${
                          passwordFeedback.level >= level ? "is-active" : ""
                        } is-${passwordFeedback.strength}`}
                      />
                    ))}
                  </div>

                  <div className="password-requirements">
                    <p
                      className={`password-requirement ${
                        passwordFeedback.hasMinLength ? "is-met" : ""
                      }`}
                    >
                      Mínimo de 6 caracteres
                    </p>
                    <p
                      className={`password-requirement ${
                        passwordFeedback.hasSpecialCharacter ? "is-met" : ""
                      }`}
                    >
                      1 caractere especial
                    </p>
                  </div>
                </div>
              ) : null}
            </label>
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
                  ? "Criando..."
                  : "Salvando..."
                : formMode === "create"
                  ? "Criar usuário"
                  : "Salvar alterações"}
            </button>

            <button
              className="btn btn-secondary"
              type="button"
              onClick={handleStartCreate}
            >
              {formMode === "create" ? "Limpar formulário" : "Novo usuário"}
            </button>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={Boolean(usersModal)}
        title={
          isStatusModalOpen
            ? statusModal?.nextStatus === "INACTIVE"
              ? "Inativar usuÃ¡rio?"
              : "Reativar usuÃ¡rio?"
            : isDeleteModalOpen
              ? "Excluir usuário?"
            : errorModal?.title || ""
        }
        description={
          isStatusModalOpen
            ? statusActionDescription
            : isDeleteModalOpen
              ? deleteActionDescription
              : errorModal?.message || ""
        }
        variant={
          isStatusModalOpen
            ? statusModal?.nextStatus === "INACTIVE"
              ? "danger"
              : "success"
            : isDeleteModalOpen
              ? "danger"
            : "warning"
        }
        icon={
          isStatusModalOpen
            ? <StatusToggleIcon />
            : isDeleteModalOpen
              ? <TrashIcon />
              : undefined
        }
        onClose={closeUsersModal}
        secondaryAction={{
          label: isStatusModalOpen || isDeleteModalOpen ? "Cancelar" : "Fechar",
          onClick: closeUsersModal,
          disabled: statusActionUserId !== null || deleteActionUserId !== null,
        }}
        primaryAction={
          isStatusModalOpen
            ? {
                label:
                  statusActionUserId !== null
                    ? statusModal?.nextStatus === "INACTIVE"
                      ? "Inativando..."
                      : "Reativando..."
                    : `Confirmar ${statusActionLabel}`,
                onClick: handleConfirmStatusChange,
                tone:
                  statusModal?.nextStatus === "INACTIVE" ? "danger" : "primary",
                icon: <StatusToggleIcon />,
                disabled: statusActionUserId !== null,
              }
            : isDeleteModalOpen
              ? {
                  label:
                    deleteActionUserId !== null
                      ? "Excluindo..."
                      : "Confirmar exclusão",
                  onClick: handleConfirmDeleteUser,
                  tone: "danger",
                  icon: <TrashIcon />,
                  disabled:
                    deleteActionUserId !== null ||
                    deleteModal?.user.id === currentUserId,
                }
            : undefined
        }
      />
    </AppLayout>
  );
}
