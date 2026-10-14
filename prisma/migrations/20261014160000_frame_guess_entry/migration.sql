-- CreateTable
CREATE TABLE "FrameGuessEntry" (
    "id" UUID NOT NULL,
    "movieId" UUID NOT NULL,
    "frames" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrameGuessEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FrameGuessEntry_movieId_key" ON "FrameGuessEntry"("movieId");

-- CreateIndex
CREATE INDEX "FrameGuessEntry_isActive_idx" ON "FrameGuessEntry"("isActive");

-- AddForeignKey
ALTER TABLE "FrameGuessEntry" ADD CONSTRAINT "FrameGuessEntry_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
