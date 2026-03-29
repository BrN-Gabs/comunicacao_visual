import { api } from "@/lib/api";
import type {
  CreateUserPayload,
  ManagedUser,
  UpdateUserPayload,
  UserStatus,
  UsersListParams,
  UsersListResponse,
} from "@/types/user";

export async function listUsers(params: UsersListParams = {}) {
  const { data } = await api.get<UsersListResponse>("/users", {
    params,
  });

  return data;
}

export async function createUser(payload: CreateUserPayload) {
  const { data } = await api.post<ManagedUser>("/users", payload);
  return data;
}

export async function updateUser(id: string, payload: UpdateUserPayload) {
  const { data } = await api.patch<ManagedUser>(`/users/${id}`, payload);
  return data;
}

export async function updateUserStatus(id: string, status: UserStatus) {
  const { data } = await api.patch<ManagedUser>(`/users/${id}/status`, {
    status,
  });

  return data;
}

export async function deleteUser(id: string) {
  const { data } = await api.delete<{ message: string }>(`/users/${id}`);
  return data;
}
