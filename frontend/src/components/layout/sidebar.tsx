"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRouteTransition } from "@/components/transition/route-transition-provider";
import { TransitionLink } from "@/components/transition/transition-link";
import { getStoredUser } from "@/lib/auth";
import { hasRoleAccess } from "@/lib/role-access";
import { LogoutIcon } from "./logout-icon";
import { getSidebarSections, isSidebarItemActive } from "./page-registry";
import { UserIcon } from "./user-icon";
import "./app-layout.css";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { startRouteTransition } = useRouteTransition();
  const user = getStoredUser();
  const sections = getSidebarSections();

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    startRouteTransition({
      label: "Saindo do painel",
      minDuration: 850,
    });
    router.push("/login");
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>Gazin Comunicações Visuais</h1>
        <p>Sistema de Comunicação Visual</p>
      </div>

      <nav className="sidebar-nav">
        {sections.map((section) => {
          const visibleItems = section.items.filter((item) => {
            return hasRoleAccess(user.role, item.role);
          });

          if (!visibleItems.length) {
            return null;
          }

          return (
            <div key={section.group} className="sidebar-group">
              <span className="sidebar-group-title">{section.group}</span>

              <div className="sidebar-links">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = isSidebarItemActive(pathname, item.href);

                  return (
                    <TransitionLink
                      key={item.href}
                      href={item.href}
                      loadingLabel={`Abrindo ${item.label}`}
                      minDuration={720}
                      className={`sidebar-link ${active ? "active" : ""}`}
                    >
                      <span className="sidebar-link-icon" aria-hidden="true">
                        <Icon />
                      </span>
                      <span className="sidebar-link-label">{item.label}</span>
                    </TransitionLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-main">
          <div className="sidebar-user-profile">
            <span className="sidebar-user-avatar" aria-hidden="true">
              <UserIcon />
            </span>

            <div className="sidebar-user-copy">
              <strong>{user?.name || "Usuario"}</strong>
              <span>{user?.role || "Perfil"}</span>
            </div>
          </div>

          <button
            className="sidebar-logout-button"
            onClick={handleLogout}
            type="button"
            aria-label="Sair"
            title="Sair"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}
