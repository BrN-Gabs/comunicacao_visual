import type { ComponentType, SVGProps } from "react";
import type { UserRole } from "@/types/user";

type PageIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type AppPageConfig = {
  id: string;
  label: string;
  title: string;
  description: string;
  href: string;
  group: string;
  icon: PageIcon;
  role?: UserRole;
  showInSidebar?: boolean;
  matches?: (pathname: string) => boolean;
};

function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 4h7v7H4z" />
      <path d="M13 4h7v4h-7z" />
      <path d="M13 10h7v10h-7z" />
      <path d="M4 13h7v7H4z" />
    </svg>
  );
}

function CommunicationsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 6h14" />
      <path d="M5 12h14" />
      <path d="M5 18h9" />
      <path d="M18 17l2 2-2 2" />
    </svg>
  );
}

function LibraryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v15.5A1.5 1.5 0 0 0 18.5 18H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}

function LogsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 4h9l5 5v11H6z" />
      <path d="M15 4v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M17 11a3 3 0 1 0 0-6" />
      <path d="M21 19v-1a4 4 0 0 0-3-3.87" />
    </svg>
  );
}

function normalizePath(pathname: string) {
  if (!pathname) {
    return "/";
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export const dashboardPage: AppPageConfig = {
  id: "dashboard",
  label: "Dashboard",
  title: "Dashboard",
  description: "Tela principal operacional com foco em leitura rapida.",
  href: "/dashboard",
  group: "Principal",
  icon: DashboardIcon,
};

export const communicationsPage: AppPageConfig = {
  id: "communications",
  label: "Comunicações Visuais",
  title: "Comunicações Visuais",
  description: "Acompanhe as comunicações visuais e os retornos operacionais.",
  href: "/communications",
  group: "Comunicação Visual",
  icon: CommunicationsIcon,
};

export const communicationDetailsPage: AppPageConfig = {
  id: "communication-details",
  label: "Detalhes",
  title: "Detalhes da comunicação visual",
  description:
    "Visualize o andamento e os dados da comunicação visual selecionada.",
  href: "/communications",
  group: "Comunicação Visual",
  icon: CommunicationsIcon,
  showInSidebar: false,
  matches: (pathname) => pathname.startsWith("/communications/"),
};

export const gazinLibraryPage: AppPageConfig = {
  id: "gazin-library",
  label: "Imagens Gazin",
  title: "Imagens Gazin",
  description: "Biblioteca oficial de imagens para as comunicações visuais.",
  href: "/gazin-library",
  group: "Comunicação Visual",
  icon: LibraryIcon,
  role: "VIP",
};

export const cityLibraryPage: AppPageConfig = {
  id: "city-library",
  label: "Imagens Cidade",
  title: "Imagens Cidade",
  description:
    "Gerencie cidades, fotógrafos e imagens que abastecem as comunicações visuais.",
  href: "/city-library",
  group: "Comunicação Visual",
  icon: LibraryIcon,
  role: "VIP",
};

export const usersPage: AppPageConfig = {
  id: "users",
  label: "Usuários",
  title: "Usuários",
  description:
    "Crie, edite e inative usuários da operação com controle administrativo.",
  href: "/users",
  group: "Administração",
  icon: UsersIcon,
  role: "ADMIN",
};

export const logsPage: AppPageConfig = {
  id: "logs",
  label: "Logs",
  title: "Logs",
  description: "Consulte os registros e auditorias do sistema.",
  href: "/logs",
  group: "Administração",
  icon: LogsIcon,
  role: "ADMIN",
};

export const appPages: AppPageConfig[] = [
  dashboardPage,
  communicationsPage,
  communicationDetailsPage,
  cityLibraryPage,
  gazinLibraryPage,
  usersPage,
  logsPage,
];

export function getSidebarSections() {
  const sections = new Map<string, AppPageConfig[]>();

  for (const page of appPages) {
    if (page.showInSidebar === false) {
      continue;
    }

    const items = sections.get(page.group) ?? [];
    items.push(page);
    sections.set(page.group, items);
  }

  return Array.from(sections.entries()).map(([group, items]) => ({
    group,
    items,
  }));
}

export function getPageConfig(pathname: string) {
  const normalizedPath = normalizePath(pathname);

  return (
    appPages.find((page) => {
      if (page.matches) {
        return page.matches(normalizedPath);
      }

      return page.href === normalizedPath;
    }) ?? null
  );
}

export function isSidebarItemActive(pathname: string, href: string) {
  const normalizedPath = normalizePath(pathname);

  return normalizedPath === href || normalizedPath.startsWith(`${href}/`);
}
