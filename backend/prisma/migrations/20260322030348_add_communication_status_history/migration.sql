-- CreateTable
CREATE TABLE "CommunicationStatusHistory" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "oldStatus" "CommunicationStatus",
    "newStatus" "CommunicationStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CommunicationStatusHistory" ADD CONSTRAINT "CommunicationStatusHistory_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationStatusHistory" ADD CONSTRAINT "CommunicationStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
