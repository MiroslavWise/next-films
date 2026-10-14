-- Очистка старых партий (сетка 16×9 больше не актуальна)
DELETE FROM "FrameRevealRound";
DELETE FROM "FrameRevealSession";

-- Новые дефолты сетки 8×5
ALTER TABLE "FrameRevealRound" ALTER COLUMN "cols" SET DEFAULT 8;
ALTER TABLE "FrameRevealRound" ALTER COLUMN "rows" SET DEFAULT 5;
