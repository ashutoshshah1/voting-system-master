-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dob" TEXT NOT NULL,
ADD COLUMN     "nid" TEXT NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CandidateAsset" (
    "id" TEXT NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "imageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateAsset_candidateId_key" ON "CandidateAsset"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "User_nid_key" ON "User"("nid");
