CREATE TABLE "CoupleQaGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "playerOneId" TEXT,
    "playerTwoId" TEXT,
    "playerOneRoomPoints" INTEGER NOT NULL DEFAULT 0,
    "playerTwoRoomPoints" INTEGER NOT NULL DEFAULT 0,
    "compatibilityScore" INTEGER NOT NULL DEFAULT 0,
    "roundIndex" INTEGER NOT NULL DEFAULT 0,
    "questionOrder" TEXT,
    "playerOneAnswer" INTEGER,
    "playerTwoAnswer" INTEGER,
    "lastMatch" BOOLEAN,
    "roundResolvedAt" DATETIME,
    "rewardGranted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoupleQaGame_playerOneId_fkey" FOREIGN KEY ("playerOneId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoupleQaGame_playerTwoId_fkey" FOREIGN KEY ("playerTwoId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CoupleQaGame_roomCode_key" ON "CoupleQaGame"("roomCode");
CREATE INDEX "CoupleQaGame_playerOneId_idx" ON "CoupleQaGame"("playerOneId");
CREATE INDEX "CoupleQaGame_playerTwoId_idx" ON "CoupleQaGame"("playerTwoId");
