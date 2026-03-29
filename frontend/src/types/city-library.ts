export type CityLibraryImage = {
  id: string;
  imageUrl: string;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CityPhotographer = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  images: CityLibraryImage[];
};

export type CityLibraryCityListItem = {
  id: string;
  name: string;
  state: string;
  fullName: string;
  createdAt: string;
  updatedAt: string;
  photographersCount: number;
  imagesCount: number;
};

export type CityLibraryCityDetails = {
  id: string;
  name: string;
  state: string;
  fullName: string;
  createdAt: string;
  updatedAt: string;
  photographersCount: number;
  imagesCount: number;
  photographers: CityPhotographer[];
};

export type CityLibraryCitiesListResponse = {
  items: CityLibraryCityListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type CityLibraryCitiesListParams = {
  search?: string;
  page?: number;
  limit?: number;
};

export type CreateCityLibraryCityPayload = {
  name: string;
  state: string;
};

export type UpdateCityLibraryCityPayload = CreateCityLibraryCityPayload;

export type CreateCityPhotographerPayload = {
  name: string;
};

export type UpdateCityPhotographerPayload = CreateCityPhotographerPayload;
