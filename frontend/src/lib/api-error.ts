export function getApiErrorMessage(error: unknown, fallback: string) {
  const data = (
    error as {
      response?: { data?: { message?: string | string[] } };
    }
  ).response?.data;

  if (Array.isArray(data?.message)) {
    return data.message.join(", ");
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  return fallback;
}

export const getApiMessage = getApiErrorMessage;
