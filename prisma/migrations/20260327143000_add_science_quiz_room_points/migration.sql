-- AlterTable
ALTER TABLE "ScienceQuizGame" ADD COLUMN "playerOneRoomPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ScienceQuizGame" ADD COLUMN "playerTwoRoomPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ScienceQuizGame" ADD COLUMN "rewardGranted" BOOLEAN NOT NULL DEFAULT false;
