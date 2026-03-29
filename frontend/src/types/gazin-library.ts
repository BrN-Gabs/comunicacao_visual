export type GazinLibraryImageStatus = "ACTIVE" | "INACTIVE";

export type GazinLibraryImage = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  status: GazinLibraryImageStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
};

export type GazinLibraryImagesListParams = {
  search?: string;
  status?: GazinLibraryImageStatus;
  page?: number;
  limit?: number;
};

export type GazinLibraryImagesListResponse = {
  items: GazinLibraryImage[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type CreateGazinLibraryImagePayload = {
  title: string;
  description: string;
  imageUrl: string;
};

export type UploadGazinLibraryImagePayload = {
  title: string;
  description: string;
  file: File;
};

export type UpdateGazinLibraryImagePayload = {
  title?: string;
  description?: string;
  imageUrl?: string;
};
