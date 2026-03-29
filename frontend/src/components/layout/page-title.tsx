import type { ReactNode } from "react";
import type { AppPageConfig } from "./page-registry";
import "./app-layout.css";

type PageTitleCardProps = {
  page: AppPageConfig;
  actions?: ReactNode;
  title?: string;
  description?: string;
};

export function PageTitleCard({
  page,
  actions,
  title,
  description,
}: PageTitleCardProps) {
  const Icon = page.icon;

  return (
    <section className="page-section">
      <div className="page-title-card">
        <div className="page-title-copy">
          <span className="page-title-icon" aria-hidden="true">
            <Icon />
          </span>

          <div className="page-title-text">
            <h1>{title ?? page.title}</h1>
            <p>{description ?? page.description}</p>
          </div>
        </div>

        {actions ? <div className="page-title-actions">{actions}</div> : null}
      </div>
    </section>
  );
}
