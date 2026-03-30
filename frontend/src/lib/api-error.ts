export function getApiErrorMessage(error: unknown, fallback: string) {
  const normalizedError = error as {
    code?: string;
    message?: string;
    response?: { data?: { message?: string | string[] } };
  };
  const data = normalizedError.response?.data;

  if (Array.isArray(data?.message)) {
    return data.message.join(", ");
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  if (normalizedError.code === "ECONNABORTED") {
    return "O envio demorou mais do que o esperado. Tente novamente em alguns instantes.";
  }

  if (!normalizedError.response && normalizedError.message === "Network Error") {
    return "Não foi possível se comunicar com o servidor.";
  }

  return fallback;
}

export const getApiMessage = getApiErrorMessage;
