-- CreateEnum
CREATE TYPE "ProjectImageStatus" AS ENUM ('USED', 'AVAILABLE');

-- CreateTable
CREATE TABLE "ProjectCityImage" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "authorName" TEXT NOT NULL,
    "creditText" TEXT NOT NULL,
    "status" "ProjectImageStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCityImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProjectCityImage" ADD CONSTRAINT "ProjectCityImage_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
