-- CreateEnum
CREATE TYPE "FrameGuessSessionStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "FrameGuessSession" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "FrameGuessSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "FrameGuessSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameGuessRound" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "frameId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageBlurhash" TEXT NOT NULL,
    "correctMovieId" UUID NOT NULL,
    "correctTitle" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "chosenMovieId" UUID,
    "isCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "FrameGuessRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FrameGuessSession_userId_status_idx" ON "FrameGuessSession"("userId", "status");

-- CreateIndex
CREATE INDEX "FrameGuessSession_userId_createdAt_idx" ON "FrameGuessSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FrameGuessRound_sessionId_createdAt_idx" ON "FrameGuessRound"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "FrameGuessRound_userId_createdAt_idx" ON "FrameGuessRound"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FrameGuessRound_sessionId_answeredAt_idx" ON "FrameGuessRound"("sessionId", "answeredAt");

-- AddForeignKey
ALTER TABLE "FrameGuessSession" ADD CONSTRAINT "FrameGuessSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameGuessRound" ADD CONSTRAINT "FrameGuessRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FrameGuessSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
