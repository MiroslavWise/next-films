import type { VoteChoice } from "@prisma/client";
import { ROUND_SIZE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import type { RoundResponse, VoteChoiceName } from "@/types/api";

const counterField = {
  WATCH_MANY: "watchManyCount",
  WATCH_ONCE: "onceEnoughCount",
  REMOVE: "removeFromIndustryCount",
} as const satisfies Record<VoteChoiceName, "watchManyCount" | "onceEnoughCount" | "removeFromIndustryCount">;

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export async function getRound(userId: string): Promise<RoundResponse> {
  const votes = await prisma.vote.findMany({
    where: { userId },
    select: { movieId: true },
  });
  const votedIds = votes.map((vote) => vote.movieId);
  const available = await prisma.movie.findMany({
    where: votedIds.length > 0 ? { id: { notIn: votedIds } } : undefined,
    select: { id: true, title: true, posterUrl: true, posterBlurhash: true },
  });
  const movies = shuffle(available).slice(0, ROUND_SIZE);
  return { movies, finished: movies.length === 0 };
}

export async function submitVotes(
  userId: string,
  votes: { movieId: string; choice: VoteChoiceName }[],
) {
  const movieIds = votes.map((vote) => vote.movieId);
  const movies = await prisma.movie.findMany({
    where: { id: { in: movieIds } },
    select: { id: true },
  });
  if (movies.length !== movieIds.length) {
    return { ok: false as const, status: 404 as const };
  }

  let processed = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const vote of votes) {
      const existing = await tx.vote.findUnique({
        where: { userId_movieId: { userId, movieId: vote.movieId } },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await tx.vote.create({
        data: {
          userId,
          movieId: vote.movieId,
          choice: vote.choice as VoteChoice,
        },
      });
      await tx.movie.update({
        where: { id: vote.movieId },
        data: { [counterField[vote.choice]]: { increment: 1 } },
      });
      processed += 1;
    }
  });

  const next = await getRound(userId);
  return { ok: true as const, processed, skipped, next };
}
