-- AlterTable
ALTER TABLE "BattleshipGame" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CoupleQaGame" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ScienceQuizGame" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LudoGame" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
