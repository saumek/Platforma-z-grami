ALTER TABLE "BattleshipGame" ADD COLUMN "isPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BattleshipGame" ADD COLUMN "pausedAt" DATETIME;
ALTER TABLE "BattleshipGame" ADD COLUMN "pauseRequestedById" TEXT;
ALTER TABLE "BattleshipGame" ADD COLUMN "exitRequestedById" TEXT;
ALTER TABLE "BattleshipGame" ADD COLUMN "terminatedAt" DATETIME;
ALTER TABLE "BattleshipGame" ADD COLUMN "terminationReason" TEXT;

ALTER TABLE "CoupleQaGame" ADD COLUMN "isPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CoupleQaGame" ADD COLUMN "pausedAt" DATETIME;
ALTER TABLE "CoupleQaGame" ADD COLUMN "pauseRequestedById" TEXT;
ALTER TABLE "CoupleQaGame" ADD COLUMN "exitRequestedById" TEXT;
ALTER TABLE "CoupleQaGame" ADD COLUMN "terminatedAt" DATETIME;
ALTER TABLE "CoupleQaGame" ADD COLUMN "terminationReason" TEXT;

ALTER TABLE "ScienceQuizGame" ADD COLUMN "isPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ScienceQuizGame" ADD COLUMN "pausedAt" DATETIME;
ALTER TABLE "ScienceQuizGame" ADD COLUMN "pauseRequestedById" TEXT;
ALTER TABLE "ScienceQuizGame" ADD COLUMN "exitRequestedById" TEXT;
ALTER TABLE "ScienceQuizGame" ADD COLUMN "terminatedAt" DATETIME;
ALTER TABLE "ScienceQuizGame" ADD COLUMN "terminationReason" TEXT;
