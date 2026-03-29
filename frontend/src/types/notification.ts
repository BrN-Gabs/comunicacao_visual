export type NotificationTone = "info" | "success" | "warning" | "danger";

export type NotificationUserRef = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "VIP" | "NORMAL";
};

export type AppNotification = {
  id: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  title: string;
  description: string;
  href: string;
  tone: NotificationTone;
  createdAt: string;
  user: NotificationUserRef | null;
};

export type NotificationsResponse = {
  notifications: AppNotification[];
  meta: {
    limit: number;
    generatedAt: string;
  };
};
