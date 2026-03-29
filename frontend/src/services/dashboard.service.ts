import { api } from "@/lib/api";
import type {
  DashboardRecentExportsResponse,
  DashboardStatusByUserResponse,
} from "@/types/dashboard";

export async function getDashboardStatusByUser() {
  const { data } = await api.get<DashboardStatusByUserResponse>(
    "/dashboard/status-by-user",
  );

  return data;
}

export async function getDashboardRecentExports() {
  const { data } = await api.get<DashboardRecentExportsResponse>(
    "/dashboard/recent-exports",
  );

  return data;
}

export async function clearDashboardRecentExports() {
  const { data } = await api.delete<{ message: string; deletedCount: number }>(
    "/dashboard/recent-exports",
  );

  return data;
}
