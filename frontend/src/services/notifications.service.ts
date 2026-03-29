import { api } from "@/lib/api";
import type { NotificationsResponse } from "@/types/notification";

export async function getRecentNotifications(limit = 12) {
  const { data } = await api.get<NotificationsResponse>("/notifications/recent", {
    params: { limit },
  });

  return data;
}
