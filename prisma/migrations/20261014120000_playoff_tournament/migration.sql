-- CreateEnum
CREATE TYPE "PlayoffStatus" AS ENUM ('GAME', 'PRE_END', 'END');

-- CreateTable
CREATE TABLE "PlayoffTournament" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PlayoffStatus" NOT NULL DEFAULT 'GAME',
    "roundIndex" INTEGER NOT NULL DEFAULT 0,
    "bracket" JSONB NOT NULL,
    "finalistMovieId" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayoffTournament_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayoffTournament_userId_status_idx" ON "PlayoffTournament"("userId", "status");

-- CreateIndex
CREATE INDEX "PlayoffTournament_userId_createdAt_idx" ON "PlayoffTournament"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlayoffTournament" ADD CONSTRAINT "PlayoffTournament_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffTournament" ADD CONSTRAINT "PlayoffTournament_finalistMovieId_fkey" FOREIGN KEY ("finalistMovieId") REFERENCES "Movie"("id") ON DELETE SET NULL ON UPDATE CASCADE;
