"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type StartRouteTransitionOptions = {
  label?: string;
  minDuration?: number;
};

type RouteTransitionContextValue = {
  startRouteTransition: (options?: StartRouteTransitionOptions) => void;
};

const DEFAULT_LABEL = "Carregando tela";
const DEFAULT_MIN_DURATION = 700;
const SAFETY_TIMEOUT = 5000;

const RouteTransitionContext = createContext<RouteTransitionContextValue | null>(
  null,
);

type ActiveTransition = {
  isVisible: boolean;
  label: string;
};

export function RouteTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const routeKey = pathname;

  const [transitionState, setTransitionState] = useState<ActiveTransition>({
    isVisible: false,
    label: DEFAULT_LABEL,
  });

  const timingsRef = useRef({
    startedAt: 0,
    minDuration: DEFAULT_MIN_DURATION,
    routeKeyAtStart: "",
  });
  const hideTimeoutRef = useRef<number | null>(null);
  const safetyTimeoutRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (safetyTimeoutRef.current !== null) {
      window.clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  }, []);

  const hideTransition = useCallback(() => {
    clearTimers();
    setTransitionState({
      isVisible: false,
      label: DEFAULT_LABEL,
    });
  }, [clearTimers]);

  const startRouteTransition = useCallback(
    (options: StartRouteTransitionOptions = {}) => {
      clearTimers();

      timingsRef.current = {
        startedAt: Date.now(),
        minDuration: options.minDuration ?? DEFAULT_MIN_DURATION,
        routeKeyAtStart: routeKey,
      };

      setTransitionState({
        isVisible: true,
        label: options.label ?? DEFAULT_LABEL,
      });

      safetyTimeoutRef.current = window.setTimeout(() => {
        hideTransition();
      }, SAFETY_TIMEOUT);
    },
    [clearTimers, hideTransition, routeKey],
  );

  useEffect(() => {
    if (!transitionState.isVisible) {
      return;
    }

    if (timingsRef.current.routeKeyAtStart === routeKey) {
      return;
    }

    const elapsed = Date.now() - timingsRef.current.startedAt;
    const remaining = Math.max(timingsRef.current.minDuration - elapsed, 0);

    hideTimeoutRef.current = window.setTimeout(() => {
      hideTransition();
    }, remaining);
  }, [hideTransition, routeKey, transitionState.isVisible]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const value = useMemo<RouteTransitionContextValue>(
    () => ({
      startRouteTransition,
    }),
    [startRouteTransition],
  );

  return (
    <RouteTransitionContext.Provider value={value}>
      {children}

      <div
        className={`route-loading ${transitionState.isVisible ? "is-visible" : ""}`}
        aria-hidden={!transitionState.isVisible}
      >
        <div className="route-loading-card" role="status" aria-live="polite">
          <span className="route-loading-orbit" aria-hidden="true">
            <span className="route-loading-core" />
          </span>
          <span className="route-loading-label">{transitionState.label}</span>
          <span className="route-loading-copy">
            Preparando a próxima tela...
          </span>
        </div>
      </div>
    </RouteTransitionContext.Provider>
  );
}

export function useRouteTransition() {
  const context = useContext(RouteTransitionContext);

  if (!context) {
    throw new Error(
      "useRouteTransition must be used within RouteTransitionProvider",
    );
  }

  return context;
}
