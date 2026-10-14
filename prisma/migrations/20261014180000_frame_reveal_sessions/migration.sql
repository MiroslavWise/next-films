-- CreateEnum
CREATE TYPE "FrameRevealSessionStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "FrameRevealSession" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "FrameRevealSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "FrameRevealSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameRevealRound" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "frameId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageBlurhash" TEXT NOT NULL,
    "correctMovieId" UUID NOT NULL,
    "correctTitle" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "cols" INTEGER NOT NULL DEFAULT 16,
    "rows" INTEGER NOT NULL DEFAULT 9,
    "openedCells" JSONB NOT NULL,
    "revealCount" INTEGER NOT NULL DEFAULT 0,
    "chosenMovieId" UUID,
    "isCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "FrameRevealRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FrameRevealSession_userId_status_idx" ON "FrameRevealSession"("userId", "status");

-- CreateIndex
CREATE INDEX "FrameRevealSession_userId_createdAt_idx" ON "FrameRevealSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FrameRevealRound_sessionId_createdAt_idx" ON "FrameRevealRound"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "FrameRevealRound_userId_createdAt_idx" ON "FrameRevealRound"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FrameRevealRound_sessionId_answeredAt_idx" ON "FrameRevealRound"("sessionId", "answeredAt");

-- AddForeignKey
ALTER TABLE "FrameRevealSession" ADD CONSTRAINT "FrameRevealSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameRevealRound" ADD CONSTRAINT "FrameRevealRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FrameRevealSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
