ALTER TABLE "BattleshipGame" ADD COLUMN "playerOneScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BattleshipGame" ADD COLUMN "playerTwoScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BattleshipGame" ADD COLUMN "playerOneShots" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "BattleshipGame" ADD COLUMN "playerTwoShots" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "BattleshipGame" ADD COLUMN "currentTurnUserId" TEXT;
ALTER TABLE "BattleshipGame" ADD COLUMN "winnerId" TEXT;
