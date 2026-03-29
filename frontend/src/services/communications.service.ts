import { api } from "@/lib/api";
import type {
  AddCommunicationFramePayload,
  AddCommunicationWallPayload,
  CommunicationDetails,
  CommunicationReadiness,
  CommunicationsListParams,
  CommunicationsListResponse,
  CommunicationSummaryResponse,
  CreateCommunicationPayload,
} from "@/types/communication";

export async function listCommunications(
  params: CommunicationsListParams = {},
) {
  const { data } = await api.get<CommunicationsListResponse>("/communications", {
    params,
  });

  return data;
}

export async function createCommunication(payload: CreateCommunicationPayload) {
  const { data } = await api.post<CommunicationDetails>("/communications", payload);
  return data;
}

export async function getCommunication(id: string) {
  const { data } = await api.get<CommunicationDetails>(`/communications/${id}`);
  return data;
}

export async function getCommunicationSummary(id: string) {
  const { data } = await api.get<CommunicationSummaryResponse>(
    `/communications/${id}/summary`,
  );
  return data;
}

export async function getCommunicationReadiness(id: string) {
  const { data } = await api.get<CommunicationReadiness>(
    `/communications/${id}/readiness`,
  );
  return data;
}

export async function assignCommunicationImages(id: string) {
  const { data } = await api.post<CommunicationDetails>(
    `/communications/${id}/assign-images`,
  );
  return data;
}

export async function addCommunicationWall(
  id: string,
  payload: AddCommunicationWallPayload,
) {
  const { data } = await api.post<{ id: string; name: string }>(
    `/communications/${id}/walls`,
    payload,
  );
  return data;
}

export async function addCommunicationFrame(
  wallId: string,
  payload: AddCommunicationFramePayload,
) {
  const { data } = await api.post<{ id: string; name: string }>(
    `/communications/walls/${wallId}/frames`,
    payload,
  );
  return data;
}

export async function deleteCommunication(id: string) {
  const { data } = await api.delete<{ message: string }>(`/communications/${id}`);
  return data;
}

export async function deleteCommunicationWall(wallId: string) {
  const { data } = await api.delete<{ message: string }>(
    `/communications/walls/${wallId}`,
  );
  return data;
}

export async function finalizeCommunication(id: string) {
  const { data } = await api.post<CommunicationDetails>(
    `/communications/${id}/finalize`,
  );
  return data;
}

export async function validateCommunication(id: string) {
  const { data } = await api.post<CommunicationDetails>(
    `/communications/${id}/validate`,
  );
  return data;
}

export async function divergeCommunication(id: string, comment: string) {
  const { data } = await api.post<CommunicationDetails>(
    `/communications/${id}/diverge`,
    { comment },
  );
  return data;
}
