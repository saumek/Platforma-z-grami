-- CreateTable
CREATE TABLE "BattleshipGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "playerOneId" TEXT,
    "playerTwoId" TEXT,
    "playerOneReady" BOOLEAN NOT NULL DEFAULT false,
    "playerTwoReady" BOOLEAN NOT NULL DEFAULT false,
    "playerOneBoard" TEXT,
    "playerTwoBoard" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BattleshipGame_playerOneId_fkey" FOREIGN KEY ("playerOneId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BattleshipGame_playerTwoId_fkey" FOREIGN KEY ("playerTwoId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BattleshipGame_roomCode_key" ON "BattleshipGame"("roomCode");

-- CreateIndex
CREATE INDEX "BattleshipGame_playerOneId_idx" ON "BattleshipGame"("playerOneId");

-- CreateIndex
CREATE INDEX "BattleshipGame_playerTwoId_idx" ON "BattleshipGame"("playerTwoId");
