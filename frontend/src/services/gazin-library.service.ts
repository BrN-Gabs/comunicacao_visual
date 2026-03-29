import { api } from "@/lib/api";
import type {
  CreateGazinLibraryImagePayload,
  GazinLibraryImage,
  GazinLibraryImagesListParams,
  GazinLibraryImagesListResponse,
  GazinLibraryImageStatus,
  UpdateGazinLibraryImagePayload,
  UploadGazinLibraryImagePayload,
} from "@/types/gazin-library";

export async function listGazinLibraryImages(
  params: GazinLibraryImagesListParams = {},
) {
  const { data } = await api.get<GazinLibraryImagesListResponse>(
    "/gazin-library",
    {
      params,
    },
  );

  return data;
}

export async function createGazinLibraryImage(
  payload: CreateGazinLibraryImagePayload,
) {
  const { data } = await api.post<GazinLibraryImage>("/gazin-library", payload);
  return data;
}

export async function uploadGazinLibraryImage(
  payload: UploadGazinLibraryImagePayload,
) {
  const formData = new FormData();
  formData.append("file", payload.file);

  const { data } = await api.post<GazinLibraryImage>(
    "/gazin-library/upload",
    formData,
    {
      params: {
        title: payload.title,
        description: payload.description,
      },
    },
  );

  return data;
}

export async function updateGazinLibraryImage(
  id: string,
  payload: UpdateGazinLibraryImagePayload,
) {
  const { data } = await api.patch<GazinLibraryImage>(
    `/gazin-library/${id}`,
    payload,
  );

  return data;
}

export async function reuploadGazinLibraryImage(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.patch<GazinLibraryImage>(
    `/gazin-library/${id}/reupload`,
    formData,
  );

  return data;
}

export async function updateGazinLibraryImageStatus(
  id: string,
  status: GazinLibraryImageStatus,
) {
  const { data } = await api.patch<GazinLibraryImage>(
    `/gazin-library/${id}/status`,
    {
      status,
    },
  );

  return data;
}

export async function deleteGazinLibraryImage(id: string) {
  const { data } = await api.delete<{ message: string }>(`/gazin-library/${id}`);
  return data;
}
