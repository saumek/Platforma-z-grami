-- CreateTable
CREATE TABLE "LudoGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "pausedAt" DATETIME,
    "pauseRequestedById" TEXT,
    "exitRequestedById" TEXT,
    "terminatedAt" DATETIME,
    "terminationReason" TEXT,
    "playerOneId" TEXT,
    "playerTwoId" TEXT,
    "playerOneColor" TEXT,
    "playerTwoColor" TEXT,
    "playerOneTokens" TEXT NOT NULL DEFAULT '[-1,-1,-1,-1]',
    "playerTwoTokens" TEXT NOT NULL DEFAULT '[-1,-1,-1,-1]',
    "currentTurnUserId" TEXT,
    "diceValue" INTEGER,
    "lastRollValue" INTEGER,
    "lastRollById" TEXT,
    "lastRollAt" DATETIME,
    "winnerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LudoGame_playerOneId_fkey" FOREIGN KEY ("playerOneId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LudoGame_playerTwoId_fkey" FOREIGN KEY ("playerTwoId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LudoGame_roomCode_key" ON "LudoGame"("roomCode");

-- CreateIndex
CREATE INDEX "LudoGame_playerOneId_idx" ON "LudoGame"("playerOneId");

-- CreateIndex
CREATE INDEX "LudoGame_playerTwoId_idx" ON "LudoGame"("playerTwoId");

