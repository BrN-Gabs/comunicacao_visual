import { api } from "@/lib/api";
import type { ProjectCityImage } from "@/types/communication";

export async function listCommunicationCityImages(communicationId: string) {
  const { data } = await api.get<ProjectCityImage[]>(
    `/communications/${communicationId}/city-images`,
  );

  return data;
}

export async function uploadCommunicationCityImages(
  communicationId: string,
  files: File[],
  authorName: string,
) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  const { data } = await api.post<ProjectCityImage[]>(
    `/communications/${communicationId}/city-images/upload`,
    formData,
    {
      params: {
        authorName,
      },
    },
  );

  return data;
}
