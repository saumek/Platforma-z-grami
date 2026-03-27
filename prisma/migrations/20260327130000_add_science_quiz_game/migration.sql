-- CreateTable
CREATE TABLE "ScienceQuizGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "playerOneId" TEXT,
    "playerTwoId" TEXT,
    "playerOneJoined" BOOLEAN NOT NULL DEFAULT false,
    "playerTwoJoined" BOOLEAN NOT NULL DEFAULT false,
    "playerOneScore" INTEGER NOT NULL DEFAULT 0,
    "playerTwoScore" INTEGER NOT NULL DEFAULT 0,
    "roundIndex" INTEGER NOT NULL DEFAULT 0,
    "questionOrder" TEXT,
    "playerOneAnswer" INTEGER,
    "playerTwoAnswer" INTEGER,
    "questionStartedAt" DATETIME,
    "roundResolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScienceQuizGame_playerOneId_fkey" FOREIGN KEY ("playerOneId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScienceQuizGame_playerTwoId_fkey" FOREIGN KEY ("playerTwoId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ScienceQuizGame_roomCode_key" ON "ScienceQuizGame"("roomCode");

-- CreateIndex
CREATE INDEX "ScienceQuizGame_playerOneId_idx" ON "ScienceQuizGame"("playerOneId");

-- CreateIndex
CREATE INDEX "ScienceQuizGame_playerTwoId_idx" ON "ScienceQuizGame"("playerTwoId");
