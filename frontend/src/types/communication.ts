export type CommunicationStatus =
  | "IN_PROGRESS"
  | "FINALIZED"
  | "DIVERGENT"
  | "VALIDATED";

export type ProjectImageStatus = "USED" | "AVAILABLE";

export type CommunicationUserRef = {
  id: string;
  name: string;
  email: string;
  role?: "ADMIN" | "VIP" | "NORMAL";
};

export type CommunicationCityLibraryRef = {
  id: string;
  name: string;
  state: string;
  fullName: string;
  photographers?: Array<{
    id: string;
    name: string;
    images: Array<{
      id: string;
      imageUrl: string;
      fileName: string | null;
    }>;
  }>;
};

export type ProjectCityImage = {
  id: string;
  communicationId: string;
  imageUrl: string;
  fileName: string | null;
  authorName: string;
  creditText: string;
  status: ProjectImageStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectGazinImage = {
  id: string;
  communicationId: string;
  gazinLibraryImageId: string;
  status: ProjectImageStatus;
  createdAt: string;
  updatedAt: string;
  gazinLibraryImage: {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    status: "ACTIVE" | "INACTIVE";
  };
};

export type CommunicationFrame = {
  id: string;
  name: string;
  order: number;
  widthM: number | string;
  heightM: number | string;
  projectCityImageId: string | null;
  projectGazinImageId: string | null;
  cityImageZoom: number;
  cityImageOffsetX: number;
  cityImageOffsetY: number;
  gazinImageZoom: number;
  gazinImageOffsetX: number;
  gazinImageOffsetY: number;
  createdAt: string;
  updatedAt: string;
  projectCityImage: ProjectCityImage | null;
  projectGazinImage: ProjectGazinImage | null;
};

export type CommunicationWall = {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  frames: CommunicationFrame[];
};

export type CommunicationDetails = {
  id: string;
  storeName: string;
  cityLibraryId: string | null;
  cityName: string;
  state: string;
  fullName: string;
  status: CommunicationStatus;
  divergenceComment: string | null;
  totalWalls: number;
  totalFrames: number;
  finalizedAt: string | null;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: CommunicationUserRef | null;
  validatedBy: CommunicationUserRef | null;
  cityLibrary: CommunicationCityLibraryRef | null;
  walls: CommunicationWall[];
};

export type CommunicationStatusHistoryItem = {
  id: string;
  oldStatus: CommunicationStatus | null;
  newStatus: CommunicationStatus;
  comment: string | null;
  createdAt: string;
  changedBy: CommunicationUserRef | null;
};

export type CommunicationReadiness = {
  communicationId: string;
  totalFrames: number;
  totalCityImages: number;
  totalProjectGazinImages: number;
  cityImagesEnough: boolean;
  gazinImagesEnough: boolean;
  canProceed: boolean;
  missingCityImages: number;
  missingGazinImages: number;
};

export type CommunicationSummaryResponse = {
  communication: CommunicationDetails;
  readiness: CommunicationReadiness;
  statusHistory: CommunicationStatusHistoryItem[];
  availableCityImages: ProjectCityImage[];
  availableGazinImages: ProjectGazinImage[];
  stats: {
    totalWalls: number;
    totalFrames: number;
    totalAssignedFrames: number;
    totalUnassignedFrames: number;
    availableCityImages: number;
    availableGazinImages: number;
  };
};

export type CommunicationListItem = {
  id: string;
  storeName: string;
  cityLibraryId?: string | null;
  cityName: string;
  state: string;
  fullName: string;
  status: CommunicationStatus;
  divergenceComment?: string | null;
  totalWalls?: number;
  totalFrames?: number;
  finalizedAt?: string | null;
  validatedAt?: string | null;
  createdBy: CommunicationUserRef | null;
  validatedBy: CommunicationUserRef | null;
  cityLibrary?: CommunicationCityLibraryRef | null;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationsListResponse = {
  items: CommunicationListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type CommunicationsListParams = {
  search?: string;
  status?: CommunicationStatus;
  page?: number;
  limit?: number;
};

export type CreateCommunicationFramePayload = {
  name?: string;
  order: number;
  widthM: number;
  heightM: number;
};

export type CreateCommunicationWallPayload = {
  name: string;
  order: number;
  frames: CreateCommunicationFramePayload[];
};

export type AddCommunicationWallPayload = {
  name: string;
};

export type AddCommunicationFramePayload = {
  name?: string;
  widthM: number;
  heightM: number;
};

export type CreateCommunicationPayload = {
  storeName: string;
  cityLibraryId: string;
  walls: CreateCommunicationWallPayload[];
};
