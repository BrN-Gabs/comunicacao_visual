"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouteTransition } from "@/components/transition/route-transition-provider";
import { TransitionLink } from "@/components/transition/transition-link";
import { getApiErrorMessage } from "@/lib/api-error";
import { getStoredUser } from "@/lib/auth";
import { subscribeToAppRefresh, triggerAppRefresh } from "@/lib/app-refresh";
import { getRecentNotifications } from "@/services/notifications.service";
import type { AppNotification } from "@/types/notification";
import { BellIcon } from "./bell-icon";
import { LogoutIcon } from "./logout-icon";
import { PlusIcon } from "./plus-icon";
import { RefreshIcon } from "./refresh-icon";
import { StatusToggleIcon } from "./status-toggle-icon";
import { TrashIcon } from "./trash-icon";
import { dashboardPage, getPageConfig } from "./page-registry";
import "./app-layout.css";

const notificationsPollIntervalMs = 45_000;
const suspiciousTextPattern = /(?:Ã.|Â.|â.|�)/;
const fallbackMojibakeEntries = [
  ["ÃƒÂ§", "ç"],
  ["ÃƒÂ£", "ã"],
  ["ÃƒÂ¡", "á"],
  ["ÃƒÂ©", "é"],
  ["ÃƒÂª", "ê"],
  ["ÃƒÂ­", "í"],
  ["ÃƒÂ³", "ó"],
  ["ÃƒÂ´", "ô"],
  ["ÃƒÂº", "ú"],
  ["ÃƒÂµ", "õ"],
  ["Ãƒâ€¡", "Ç"],
  ["Ãƒâ€œ", "Ó"],
  ["Ã§", "ç"],
  ["Ã£", "ã"],
  ["Ã¡", "á"],
  ["Ã©", "é"],
  ["Ãª", "ê"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ã´", "ô"],
  ["Ãº", "ú"],
  ["Ãµ", "õ"],
  ["Ã‡", "Ç"],
  ["Ã“", "Ó"],
  ["Â", ""],
] as const;

function getNotificationsLastReadStorageKey(userId: string) {
  return `notifications:last-read:${userId}`;
}

function getNotificationsHiddenStorageKey(userId: string) {
  return `notifications:hidden:${userId}`;
}

function readStoredNotificationIds(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        )
      : [];
  } catch {
    return [];
  }
}

function normalizeNotificationText(value: string) {
  let nextValue = value;

  for (
    let attempt = 0;
    attempt < 3 && suspiciousTextPattern.test(nextValue);
    attempt += 1
  ) {
    try {
      const decodedValue = decodeURIComponent(escape(nextValue));

      if (!decodedValue || decodedValue === nextValue) {
        break;
      }

      nextValue = decodedValue;
    } catch {
      break;
    }
  }

  for (const [brokenValue, fixedValue] of fallbackMojibakeEntries) {
    nextValue = nextValue.split(brokenValue).join(fixedValue);
  }

  return nextValue;
}

function formatNotificationDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getUnreadNotificationsCount(
  notifications: AppNotification[],
  lastReadAt: string | null,
) {
  if (!lastReadAt) {
    return 0;
  }

  const lastReadTimestamp = new Date(lastReadAt).getTime();

  if (Number.isNaN(lastReadTimestamp)) {
    return 0;
  }

  return notifications.filter((notification) => {
    const createdAtTimestamp = new Date(notification.createdAt).getTime();
    return !Number.isNaN(createdAtTimestamp) && createdAtTimestamp > lastReadTimestamp;
  }).length;
}

function isNotificationUnread(
  notification: AppNotification,
  lastReadAt: string | null,
) {
  if (!lastReadAt) {
    return false;
  }

  const lastReadTimestamp = new Date(lastReadAt).getTime();
  const createdAtTimestamp = new Date(notification.createdAt).getTime();

  return (
    !Number.isNaN(lastReadTimestamp) &&
    !Number.isNaN(createdAtTimestamp) &&
    createdAtTimestamp > lastReadTimestamp
  );
}

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { startRouteTransition } = useRouteTransition();
  const currentPage = getPageConfig(pathname) ?? dashboardPage;
  const storedUser = getStoredUser();
  const currentUserId = storedUser.id ?? null;
  const [isPending, startTransition] = useTransition();
  const [refreshState, setRefreshState] = useState<"idle" | "refreshing" | "done">(
    "idle",
  );
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [notificationsError, setNotificationsError] = useState("");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const resetTimeoutRef = useRef<number | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const hiddenNotificationIdsRef = useRef<string[]>([]);
  const lastReadAtRef = useRef<string | null>(null);

  const persistLastReadAt = useCallback(
    (value: string | null) => {
      lastReadAtRef.current = value;
      setLastReadAt(value);

      if (!currentUserId) {
        return;
      }

      const storageKey = getNotificationsLastReadStorageKey(currentUserId);

      if (value) {
        localStorage.setItem(storageKey, value);
      } else {
        localStorage.removeItem(storageKey);
      }
    },
    [currentUserId],
  );

  const persistHiddenNotificationIds = useCallback(
    (value: string[]) => {
      const nextIds = Array.from(new Set(value));
      hiddenNotificationIdsRef.current = nextIds;

      if (!currentUserId) {
        return;
      }

      const storageKey = getNotificationsHiddenStorageKey(currentUserId);

      if (nextIds.length) {
        localStorage.setItem(storageKey, JSON.stringify(nextIds));
      } else {
        localStorage.removeItem(storageKey);
      }
    },
    [currentUserId],
  );

  const syncUnreadNotifications = useCallback(
    (nextNotifications: AppNotification[], nextLastReadAt: string | null) => {
      setUnreadNotificationsCount(
        getUnreadNotificationsCount(nextNotifications, nextLastReadAt),
      );
    },
    [],
  );

  const loadNotifications = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setIsLoadingNotifications(true);
      }

      setNotificationsError("");

      try {
        const response = await getRecentNotifications();
        const visibleNotifications = response.notifications.filter(
          (notification) =>
            !hiddenNotificationIdsRef.current.includes(notification.id),
        );

        setNotifications(visibleNotifications);

        let effectiveLastReadAt = lastReadAtRef.current;
        const latestNotificationDate = visibleNotifications[0]?.createdAt ?? null;

        if (!effectiveLastReadAt && latestNotificationDate) {
          persistLastReadAt(latestNotificationDate);
          effectiveLastReadAt = latestNotificationDate;
        }

        syncUnreadNotifications(visibleNotifications, effectiveLastReadAt);
      } catch (error) {
        setNotificationsError(
          getApiErrorMessage(error, "Nao foi possivel carregar as notificacoes."),
        );
      } finally {
        if (!silent) {
          setIsLoadingNotifications(false);
        }
      }
    },
    [persistLastReadAt, syncUnreadNotifications],
  );

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      persistLastReadAt(null);
      persistHiddenNotificationIds([]);
      setNotifications([]);
      setUnreadNotificationsCount(0);
      return;
    }

    const storedLastReadAt = localStorage.getItem(
      getNotificationsLastReadStorageKey(currentUserId),
    );
    const storedHiddenNotificationIds = readStoredNotificationIds(
      localStorage.getItem(getNotificationsHiddenStorageKey(currentUserId)),
    );

    lastReadAtRef.current = storedLastReadAt;
    hiddenNotificationIdsRef.current = storedHiddenNotificationIds;
    setLastReadAt(storedLastReadAt);

    void loadNotifications();
  }, [
    currentUserId,
    loadNotifications,
    persistHiddenNotificationIds,
    persistLastReadAt,
  ]);

  useEffect(
    () => subscribeToAppRefresh(() => void loadNotifications({ silent: true })),
    [loadNotifications],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadNotifications({ silent: true });
    }, notificationsPollIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [loadNotifications]);

  useEffect(() => {
    setIsNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isNotificationsOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNotificationsOpen]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    startRouteTransition({
      label: "Saindo do painel",
      minDuration: 850,
    });
    router.push("/login");
  }

  function handleRefresh() {
    if (refreshState === "refreshing") {
      return;
    }

    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }

    setRefreshState("refreshing");
    triggerAppRefresh();

    startTransition(() => {
      router.refresh();
    });

    resetTimeoutRef.current = window.setTimeout(() => {
      setRefreshState("done");

      resetTimeoutRef.current = window.setTimeout(() => {
        setRefreshState("idle");
        resetTimeoutRef.current = null;
      }, 1800);
    }, 700);
  }

  function handleToggleNotifications() {
    setIsNotificationsOpen((current) => !current);
  }

  function handleMarkAllNotificationsAsRead() {
    const latestNotificationDate = notifications[0]?.createdAt ?? null;

    if (!latestNotificationDate) {
      return;
    }

    persistLastReadAt(latestNotificationDate);
    syncUnreadNotifications(notifications, latestNotificationDate);
  }

  function handleClearNotifications() {
    if (!notifications.length) {
      return;
    }

    persistHiddenNotificationIds([
      ...hiddenNotificationIdsRef.current,
      ...notifications.map((notification) => notification.id),
    ]);
    setNotifications([]);
    setUnreadNotificationsCount(0);
  }

  function handleNotificationClick(notification: AppNotification) {
    const notificationTimestamp = new Date(notification.createdAt).getTime();
    const currentLastReadTimestamp = lastReadAtRef.current
      ? new Date(lastReadAtRef.current).getTime()
      : Number.NEGATIVE_INFINITY;

    if (
      !Number.isNaN(notificationTimestamp) &&
      notificationTimestamp > currentLastReadTimestamp
    ) {
      persistLastReadAt(notification.createdAt);
      syncUnreadNotifications(notifications, notification.createdAt);
    }

    setIsNotificationsOpen(false);
  }

  const refreshLabel =
    refreshState === "refreshing"
      ? "Atualizando informações"
      : refreshState === "done"
        ? "Informações atualizadas"
        : "Atualizar";
  const notificationsLabel =
    unreadNotificationsCount > 0
      ? `Notificações, ${unreadNotificationsCount} não lida(s)`
      : "Notificações";
  const unreadNotificationsBadge =
    unreadNotificationsCount > 9 ? "9+" : String(unreadNotificationsCount);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div>
          <h2>{currentPage.label}</h2>
        </div>
      </div>

      <div className="topbar-actions">
        <TransitionLink
          href="/communications"
          loadingLabel="Abrindo Comunicações Visuais"
          minDuration={760}
          className="btn btn-primary btn-with-icon"
        >
          <PlusIcon />
          <span>Comunicação Visual</span>
        </TransitionLink>

        <div className="topbar-notifications" ref={notificationsRef}>
          <button
            className={`btn btn-secondary btn-icon btn-notifications ${
              isNotificationsOpen ? "is-open" : ""
            }`}
            type="button"
            aria-label={notificationsLabel}
            aria-expanded={isNotificationsOpen}
            aria-haspopup="dialog"
            title={notificationsLabel}
            onClick={handleToggleNotifications}
          >
            <BellIcon />
            {unreadNotificationsCount > 0 ? (
              <span className="topbar-notification-badge">
                {unreadNotificationsBadge}
              </span>
            ) : null}
          </button>

          {isNotificationsOpen ? (
            <div className="notifications-popover" role="dialog" aria-label="Notificacoes">
              <div className="notifications-popover-header">
                <div className="notifications-popover-copy">
                  <strong>Notificações</strong>
                  <span>
                    {unreadNotificationsCount > 0
                      ? `${unreadNotificationsCount} não lida(s)`
                      : "Tudo em dia por aqui"}
                  </span>
                </div>

                <div className="notifications-popover-actions">
                  <button
                    type="button"
                    className="notifications-popover-icon"
                    onClick={() => void loadNotifications()}
                    title="Atualizar notificacoes"
                    aria-label="Atualizar notificacoes"
                  >
                    <RefreshIcon />
                    <span className="sr-only">Atualizar</span>
                  </button>
                  <button
                    type="button"
                    className="notifications-popover-icon"
                    onClick={handleMarkAllNotificationsAsRead}
                    disabled={!unreadNotificationsCount}
                    title="Marcar tudo como lido"
                    aria-label="Marcar tudo como lido"
                  >
                    <StatusToggleIcon />
                    <span className="sr-only">Marcar tudo como lido</span>
                  </button>
                  <button
                    type="button"
                    className="notifications-popover-icon"
                    onClick={handleClearNotifications}
                    disabled={!notifications.length}
                    title="Limpar notificacoes"
                    aria-label="Limpar notificacoes"
                  >
                    <TrashIcon />
                    <span className="sr-only">Limpar</span>
                  </button>
                </div>
              </div>

              {isLoadingNotifications ? (
                <div className="notifications-popover-state">
                  Carregando notificações...
                </div>
              ) : null}

              {!isLoadingNotifications && notificationsError ? (
                <div className="notifications-popover-state is-error">
                  {notificationsError}
                </div>
              ) : null}

              {!isLoadingNotifications &&
              !notificationsError &&
              !notifications.length ? (
                <div className="notifications-popover-state">
                  Nenhuma notificação visível no momento.
                </div>
              ) : null}

              {!isLoadingNotifications && !notificationsError && notifications.length ? (
                <div className="notifications-popover-list">
                  {notifications.map((notification) => {
                    const unread = isNotificationUnread(notification, lastReadAt);

                    return (
                      <TransitionLink
                        key={notification.id}
                        href={notification.href}
                        className={`notification-item is-${notification.tone} ${
                          unread ? "is-unread" : ""
                        }`}
                        loadingLabel="Abrindo notificacao"
                        minDuration={560}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="notification-item-copy">
                          <strong>
                            {normalizeNotificationText(notification.title)}
                          </strong>
                          <span>
                            {normalizeNotificationText(notification.description)}
                          </span>
                          {notification.entityLabel ? (
                            <small>
                              {normalizeNotificationText(notification.entityLabel)}
                            </small>
                          ) : null}
                        </div>

                        <div className="notification-item-meta">
                          <span>{notification.user?.name ?? "Sistema"}</span>
                          <div className="notification-item-meta-end">
                            {unread ? (
                              <span className="notification-item-unread">
                                Não lida
                              </span>
                            ) : null}
                            <time dateTime={notification.createdAt}>
                              {formatNotificationDate(notification.createdAt)}
                            </time>
                          </div>
                        </div>
                      </TransitionLink>
                    );
                  })}
                </div>
              ) : null}

              <div className="notifications-popover-footer">
                <TransitionLink
                  href="/logs"
                  className="notifications-popover-link"
                  loadingLabel="Abrindo logs"
                  minDuration={560}
                  onClick={() => setIsNotificationsOpen(false)}
                >
                  Ver todos os registros
                </TransitionLink>
              </div>
            </div>
          ) : null}
        </div>

        <button
          className={`btn btn-secondary btn-icon btn-refresh ${
            refreshState === "refreshing"
              ? "is-refreshing"
              : refreshState === "done"
                ? "is-done"
                : ""
          }`}
          type="button"
          aria-label={refreshLabel}
          title={refreshLabel}
          onClick={handleRefresh}
          disabled={refreshState === "refreshing" || isPending}
        >
          <RefreshIcon />
        </button>

        <button
          className="btn btn-danger btn-icon"
          onClick={handleLogout}
          type="button"
          aria-label="Sair"
          title="Sair"
        >
          <LogoutIcon />
        </button>

        <span className="sr-only" aria-live="polite">
          {refreshState === "idle" ? "" : refreshLabel}
        </span>
      </div>
    </header>
  );
}
