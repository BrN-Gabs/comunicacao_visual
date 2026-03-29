-- CreateTable
CREATE TABLE "ProjectGazinImage" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "gazinLibraryImageId" TEXT NOT NULL,
    "status" "ProjectImageStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectGazinImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectGazinImage_communicationId_gazinLibraryImageId_key" ON "ProjectGazinImage"("communicationId", "gazinLibraryImageId");

-- AddForeignKey
ALTER TABLE "ProjectGazinImage" ADD CONSTRAINT "ProjectGazinImage_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGazinImage" ADD CONSTRAINT "ProjectGazinImage_gazinLibraryImageId_fkey" FOREIGN KEY ("gazinLibraryImageId") REFERENCES "GazinLibraryImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
