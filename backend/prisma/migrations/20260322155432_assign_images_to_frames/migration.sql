-- AlterTable
ALTER TABLE "Frame" ADD COLUMN     "projectCityImageId" TEXT,
ADD COLUMN     "projectGazinImageId" TEXT;

-- AddForeignKey
ALTER TABLE "Frame" ADD CONSTRAINT "Frame_projectCityImageId_fkey" FOREIGN KEY ("projectCityImageId") REFERENCES "ProjectCityImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Frame" ADD CONSTRAINT "Frame_projectGazinImageId_fkey" FOREIGN KEY ("projectGazinImageId") REFERENCES "ProjectGazinImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
