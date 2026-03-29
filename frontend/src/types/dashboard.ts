import type { UserRole } from "./user";

export type DashboardUserStatus = {
  userId: string;
  name: string;
  role: UserRole;
  finalizedCount: number;
  openCount: number;
};

export type DashboardStatusByUserResponse = {
  userStatus: DashboardUserStatus[];
};

export type DashboardRecentExport = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  description: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
};

export type DashboardRecentExportsResponse = {
  recentExports: DashboardRecentExport[];
};
