"use client";

import { type MouseEvent, type ReactNode, useId } from "react";
import { NoticeIcon } from "@/components/layout/notice-icon";

type AppModalVariant = "warning" | "danger" | "success" | "info";
type AppModalActionTone = "primary" | "secondary" | "danger";
type AppModalSize = "default" | "large" | "xlarge";

type AppModalAction = {
  label: string;
  onClick: () => void;
  tone?: AppModalActionTone;
  icon?: ReactNode;
  disabled?: boolean;
};

type AppModalProps = {
  open: boolean;
  title: string;
  description: string;
  variant?: AppModalVariant;
  size?: AppModalSize;
  icon?: ReactNode;
  children?: ReactNode;
  primaryAction?: AppModalAction;
  secondaryAction?: AppModalAction;
  onClose?: () => void;
  closeOnBackdropClick?: boolean;
};

function getActionClassName(tone: AppModalActionTone, hasIcon: boolean) {
  const toneClassName =
    tone === "danger"
      ? "btn btn-danger"
      : tone === "secondary"
        ? "btn btn-secondary"
        : "btn btn-primary";

  return hasIcon ? `${toneClassName} btn-with-icon` : toneClassName;
}

export function AppModal({
  open,
  title,
  description,
  variant = "warning",
  size = "default",
  icon,
  children,
  primaryAction,
  secondaryAction,
  onClose,
  closeOnBackdropClick = true,
}: AppModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) {
    return null;
  }

  function handleBackdropClick() {
    if (!closeOnBackdropClick || !onClose) {
      return;
    }

    onClose();
  }

  function handleCardClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  const hasActions = Boolean(primaryAction || secondaryAction);
  const cardClassName = [
    "app-modal-card",
    size !== "default" ? `is-${size}` : "",
    children ? "has-body" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="app-modal-backdrop"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        className={cardClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={handleCardClick}
      >
        <div className="app-modal-header">
          <span className={`app-modal-icon is-${variant}`} aria-hidden="true">
            {icon ?? <NoticeIcon />}
          </span>

          <div className="app-modal-copy">
            <h4 id={titleId}>{title}</h4>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
        </div>

        {children ? <div className="app-modal-body">{children}</div> : null}

        {hasActions ? (
          <div className="app-modal-actions">
            {secondaryAction ? (
              <button
                className={getActionClassName(
                  secondaryAction.tone ?? "secondary",
                  Boolean(secondaryAction.icon),
                )}
                type="button"
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
              >
                {secondaryAction.icon}
                <span>{secondaryAction.label}</span>
              </button>
            ) : null}

            {primaryAction ? (
              <button
                className={getActionClassName(
                  primaryAction.tone ?? "primary",
                  Boolean(primaryAction.icon),
                )}
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
              >
                {primaryAction.icon}
                <span>{primaryAction.label}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
