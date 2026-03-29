-- CreateTable
CREATE TABLE "CityLibraryCity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityLibraryCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityPhotographer" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityPhotographer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityLibraryImage" (
    "id" TEXT NOT NULL,
    "photographerId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityLibraryImage_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Communication" ADD COLUMN "cityLibraryId" TEXT;

-- AddForeignKey
ALTER TABLE "Communication"
ADD CONSTRAINT "Communication_cityLibraryId_fkey"
FOREIGN KEY ("cityLibraryId") REFERENCES "CityLibraryCity"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityPhotographer"
ADD CONSTRAINT "CityPhotographer_cityId_fkey"
FOREIGN KEY ("cityId") REFERENCES "CityLibraryCity"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityLibraryImage"
ADD CONSTRAINT "CityLibraryImage_photographerId_fkey"
FOREIGN KEY ("photographerId") REFERENCES "CityPhotographer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
