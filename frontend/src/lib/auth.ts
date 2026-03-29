import type { AppUser } from "@/types/user";

export function getStoredUser(): Partial<AppUser> {
  if (typeof window === "undefined") {
    return {};
  }

  const rawUser = localStorage.getItem("user");

  if (!rawUser) {
    return {};
  }

  try {
    return JSON.parse(rawUser) as Partial<AppUser>;
  } catch {
    return {};
  }
}
