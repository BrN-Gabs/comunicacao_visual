import { api } from "@/lib/api";

export type LoginPayload = {
  email: string;
  password: string;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type ValidateResetPasswordTokenPayload = {
  token: string;
};

export type ResetPasswordPayload = {
  token: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "VIP" | "NORMAL";
  };
};

export async function login(payload: LoginPayload) {
  const { data } = await api.post<LoginResponse>("/auth/login", payload);
  return data;
}

export async function requestPasswordRecovery(payload: ForgotPasswordPayload) {
  const { data } = await api.post<{ message: string }>(
    "/auth/forgot-password",
    payload,
  );

  return data;
}

export async function validatePasswordResetToken(
  payload: ValidateResetPasswordTokenPayload,
) {
  const { data } = await api.post<{
    message: string;
    user: {
      name: string;
      email: string;
    };
  }>("/auth/reset-password/validate", payload);

  return data;
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const { data } = await api.post<{ message: string }>(
    "/auth/reset-password",
    payload,
  );

  return data;
}

export async function getMe() {
  const { data } = await api.get("/users/me");
  return data;
}
