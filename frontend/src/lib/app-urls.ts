export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "/api";

export const apiAssetBaseUrl = apiBaseUrl.replace(/\/api$/, "");

function isExternalHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isValidHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveAssetUrl(value?: string | null) {
  const normalizedValue = value?.trim() ?? "";

  if (!normalizedValue) {
    return "";
  }

  if (isExternalHttpUrl(normalizedValue)) {
    return isValidHttpUrl(normalizedValue) ? normalizedValue : "";
  }

  return `${apiAssetBaseUrl}${
    normalizedValue.startsWith("/") ? normalizedValue : `/${normalizedValue}`
  }`;
}
