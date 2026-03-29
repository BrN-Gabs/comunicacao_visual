"use client";

import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { CopyrightIcon } from "./copyright-icon";
import { useAuthGuard } from "@/hooks/use-auth";
import "./app-layout.css";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isReady } = useAuthGuard();

  if (!isReady) return null;

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <Header />

        <main className="app-content">
          {children}
        </main>

        <footer className="app-footer">
          <span className="app-footer-copy">
            <span className="app-footer-icon" aria-hidden="true">
              <CopyrightIcon />
            </span>
            <span>Todos os direitos reservados a Bruno Gabriel da Silva.</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
