import { api } from "@/lib/api";
import type { CommunicationFrame } from "@/types/communication";

export async function swapFrameCityImage(
  frameId: string,
  targetProjectCityImageId: string,
) {
  const { data } = await api.post<CommunicationFrame>(
    `/frames/${frameId}/swap-city-image`,
    {
      targetProjectCityImageId,
    },
  );

  return data;
}

export async function swapFrameGazinImage(
  frameId: string,
  targetProjectGazinImageId: string,
) {
  const { data } = await api.post<CommunicationFrame>(
    `/frames/${frameId}/swap-gazin-image`,
    {
      targetProjectGazinImageId,
    },
  );

  return data;
}

export async function updateFrameDimensions(
  frameId: string,
  widthM: number,
  heightM: number,
) {
  const { data } = await api.patch<CommunicationFrame>(
    `/frames/${frameId}/dimensions`,
    {
      widthM,
      heightM,
    },
  );

  return data;
}

export async function updateFrameImageLayout(
  frameId: string,
  payload: {
    cityImageZoom: number;
    cityImageOffsetX: number;
    cityImageOffsetY: number;
    gazinImageZoom: number;
    gazinImageOffsetX: number;
    gazinImageOffsetY: number;
  },
) {
  const { data } = await api.patch<CommunicationFrame>(
    `/frames/${frameId}/image-layout`,
    payload,
  );

  return data;
}

export async function deleteFrame(frameId: string) {
  const { data } = await api.delete<{ message: string }>(`/frames/${frameId}`);
  return data;
}
