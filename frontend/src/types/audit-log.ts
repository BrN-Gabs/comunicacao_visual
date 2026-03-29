export type AuditLogUserRef = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "VIP" | "NORMAL";
};

export type AuditLogItem = {
  id: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  description: string;
  metadata: unknown;
  createdAt: string;
  user: AuditLogUserRef | null;
};

export type AuditLogsListParams = {
  page?: number;
  limit?: number;
  module?: string;
  action?: string;
  entityType?: string;
  search?: string;
  userId?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
};

export type AuditLogsListResponse = {
  items: AuditLogItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type AuditLogFilterOptionsResponse = {
  modules: string[];
  actions: string[];
  entityTypes: string[];
  users: AuditLogUserRef[];
  dateRange: {
    oldestAt: string | null;
    newestAt: string | null;
  };
};

export type AuditLogsMonthlySummary = {
  year: number;
  month: number;
  period: {
    start: string;
    end: string;
  };
  total: number;
  communications: {
    created: number;
    updated: number;
    deleted: number;
    finalized: number;
    validated: number;
    diverged: number;
    assignedImages: number;
  };
  frames: {
    swapCityImage: number;
    swapGazinImage: number;
    updateDimensions: number;
  };
  gazinLibrary: {
    created: number;
    updated: number;
    updatedStatus: number;
    deleted: number;
  };
  cityImages: {
    createdMany: number;
    updated: number;
    deleted: number;
  };
  projectGazinImages: {
    synced: number;
    deleted: number;
  };
  users: {
    created: number;
    updatedRole: number;
    updatedStatus: number;
  };
  byModule: Record<string, number>;
  byAction: Record<string, number>;
  topUsers: Array<{
    userId: string | null;
    name: string;
    email: string | null;
    role: string | null;
    totalActions: number;
  }>;
};
