import { api } from "@/lib/api";
import { IMAGE_UPLOAD_REQUEST_TIMEOUT_MS } from "@/lib/upload";
import type {
  CityLibraryCitiesListParams,
  CityLibraryCitiesListResponse,
  CityLibraryCityDetails,
  CreateCityLibraryCityPayload,
  CreateCityPhotographerPayload,
  UpdateCityLibraryCityPayload,
  UpdateCityPhotographerPayload,
} from "@/types/city-library";

export async function listCityLibraryCities(
  params: CityLibraryCitiesListParams = {},
) {
  const { data } = await api.get<CityLibraryCitiesListResponse>(
    "/city-library/cities",
    {
      params,
    },
  );

  return data;
}

export async function getCityLibraryCity(id: string) {
  const { data } = await api.get<CityLibraryCityDetails>(
    `/city-library/cities/${id}`,
  );
  return data;
}

export async function createCityLibraryCity(
  payload: CreateCityLibraryCityPayload,
) {
  const { data } = await api.post<CityLibraryCityDetails>(
    "/city-library/cities",
    payload,
  );
  return data;
}

export async function updateCityLibraryCity(
  id: string,
  payload: UpdateCityLibraryCityPayload,
) {
  const { data } = await api.patch<CityLibraryCityDetails>(
    `/city-library/cities/${id}`,
    payload,
  );
  return data;
}

export async function deleteCityLibraryCity(id: string) {
  const { data } = await api.delete<{ message: string }>(
    `/city-library/cities/${id}`,
  );
  return data;
}

export async function createCityPhotographer(
  cityId: string,
  payload: CreateCityPhotographerPayload,
) {
  const { data } = await api.post(
    `/city-library/cities/${cityId}/photographers`,
    payload,
  );
  return data;
}

export async function updateCityPhotographer(
  id: string,
  payload: UpdateCityPhotographerPayload,
) {
  const { data } = await api.patch(`/city-library/photographers/${id}`, payload);
  return data;
}

export async function deleteCityPhotographer(id: string) {
  const { data } = await api.delete<{ message: string }>(
    `/city-library/photographers/${id}`,
  );
  return data;
}

export async function uploadCityPhotographerImages(
  photographerId: string,
  files: File[],
) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const { data } = await api.post<CityLibraryCityDetails>(
    `/city-library/photographers/${photographerId}/images/upload`,
    formData,
    {
      timeout: IMAGE_UPLOAD_REQUEST_TIMEOUT_MS,
    },
  );

  return data;
}

export async function reuploadCityLibraryImage(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.patch(`/city-library/images/${id}/reupload`, formData, {
    timeout: IMAGE_UPLOAD_REQUEST_TIMEOUT_MS,
  });

  return data;
}

export async function deleteCityLibraryImage(id: string) {
  const { data } = await api.delete<{ message: string }>(
    `/city-library/images/${id}`,
  );
  return data;
}
