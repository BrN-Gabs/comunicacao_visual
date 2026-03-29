import { api } from "@/lib/api";
import type { ProjectGazinImage } from "@/types/communication";

export async function syncCommunicationGazinImages(communicationId: string) {
  const { data } = await api.post<ProjectGazinImage[]>(
    `/communications/${communicationId}/project-gazin-images/sync`,
  );

  return data;
}

export async function listCommunicationGazinImages(communicationId: string) {
  const { data } = await api.get<ProjectGazinImage[]>(
    `/communications/${communicationId}/project-gazin-images`,
  );

  return data;
}
