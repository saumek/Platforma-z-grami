ALTER TABLE "User" ADD COLUMN "currentRoomCode" TEXT;

CREATE INDEX "User_currentRoomCode_idx" ON "User"("currentRoomCode");
