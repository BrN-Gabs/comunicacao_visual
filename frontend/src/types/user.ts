export type UserRole = "ADMIN" | "VIP" | "NORMAL";

export type UserStatus = "ACTIVE" | "INACTIVE";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
};

export type ManagedUser = AppUser & {
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

export type UsersListParams = {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  page?: number;
  limit?: number;
};

export type UsersListResponse = {
  items: ManagedUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

export type UpdateUserPayload = {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
};
