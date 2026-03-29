"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type ThemeMode = "light" | "dark";
type FloatingPosition = {
  x: number;
  y: number;
};

const THEME_STORAGE_KEY = "gazin-theme-mode";
const POSITION_STORAGE_KEY = "gazin-theme-toggle-position";
const BUTTON_WIDTH = 62;
const BUTTON_HEIGHT = 62;
const VIEWPORT_MARGIN = 18;
const DRAG_THRESHOLD = 6;

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v3" />
      <path d="M12 18.5v3" />
      <path d="M4.9 4.9l2.1 2.1" />
      <path d="M17 17l2.1 2.1" />
      <path d="M2.5 12h3" />
      <path d="M18.5 12h3" />
      <path d="M4.9 19.1 7 17" />
      <path d="M17 7l2.1-2.1" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 14.2A7.8 7.8 0 1 1 9.8 4 6.4 6.4 0 0 0 20 14.2Z" />
    </svg>
  );
}

function getDefaultPosition(): FloatingPosition {
  if (typeof window === "undefined") {
    return { x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN };
  }

  return {
    x: window.innerWidth - BUTTON_WIDTH - VIEWPORT_MARGIN,
    y: window.innerHeight - BUTTON_HEIGHT - VIEWPORT_MARGIN,
  };
}

function clampPosition(position: FloatingPosition): FloatingPosition {
  if (typeof window === "undefined") {
    return position;
  }

  const maxX = Math.max(
    VIEWPORT_MARGIN,
    window.innerWidth - BUTTON_WIDTH - VIEWPORT_MARGIN,
  );
  const maxY = Math.max(
    VIEWPORT_MARGIN,
    window.innerHeight - BUTTON_HEIGHT - VIEWPORT_MARGIN,
  );

  return {
    x: Math.min(Math.max(position.x, VIEWPORT_MARGIN), maxX),
    y: Math.min(Math.max(position.y, VIEWPORT_MARGIN), maxY),
  };
}

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredPosition(): FloatingPosition {
  if (typeof window === "undefined") {
    return getDefaultPosition();
  }

  const rawValue = window.localStorage.getItem(POSITION_STORAGE_KEY);

  if (!rawValue) {
    return getDefaultPosition();
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<FloatingPosition>;

    if (
      typeof parsedValue.x === "number" &&
      typeof parsedValue.y === "number"
    ) {
      return clampPosition({
        x: parsedValue.x,
        y: parsedValue.y,
      });
    }
  } catch {}

  return getDefaultPosition();
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeController({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [position, setPosition] = useState<FloatingPosition>({
    x: VIEWPORT_MARGIN,
    y: VIEWPORT_MARGIN,
  });
  const [isDragging, setIsDragging] = useState(false);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dragStateRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  useEffect(() => {
    const nextTheme = getStoredTheme();
    const nextPosition = getStoredPosition();

    setTheme(nextTheme);
    setPosition(nextPosition);
    applyTheme(nextTheme);
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [isReady, theme]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
  }, [isReady, position]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    function handleResize() {
      setPosition((current) => clampPosition(current));
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isReady]);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    const element = buttonRef.current;

    if (!element) {
      return;
    }

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };

    element.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const dragState = dragStateRef.current;

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (
      !dragState.moved &&
      (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)
    ) {
      dragState.moved = true;
      setIsDragging(true);
    }

    if (!dragState.moved) {
      return;
    }

    setPosition(
      clampPosition({
        x: dragState.originX + deltaX,
        y: dragState.originY + deltaY,
      }),
    );
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const element = buttonRef.current;
    const dragState = dragStateRef.current;

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (element?.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }

    dragState.active = false;
    dragState.pointerId = -1;
    setIsDragging(false);
  }

  function handleClick() {
    const dragState = dragStateRef.current;

    if (dragState.moved) {
      dragState.moved = false;
      return;
    }

    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
  }

  const buttonLabel =
    theme === "light" ? "Ativar modo escuro" : "Ativar modo claro";
  const ActiveThemeIcon = theme === "light" ? SunIcon : MoonIcon;

  return (
    <>
      {children}

      {isReady ? (
        <button
          ref={buttonRef}
          type="button"
          className="theme-fab"
          data-theme-mode={theme}
          data-dragging={isDragging ? "true" : "false"}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
          aria-label={buttonLabel}
          title={buttonLabel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleClick}
        >
          <span className="theme-fab-surface">
            <span className="theme-fab-icon" aria-hidden="true">
              <ActiveThemeIcon />
            </span>
          </span>
        </button>
      ) : null}
    </>
  );
}
