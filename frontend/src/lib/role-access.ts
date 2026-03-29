import type { UserRole } from "@/types/user";

const roleLevel: Record<UserRole, number> = {
  NORMAL: 1,
  VIP: 2,
  ADMIN: 3,
};

export function hasRoleAccess(
  userRole: UserRole | null | undefined,
  requiredRole?: UserRole,
) {
  if (!requiredRole) {
    return true;
  }

  if (!userRole) {
    return false;
  }

  return roleLevel[userRole] >= roleLevel[requiredRole];
}
