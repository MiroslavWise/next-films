import { Prisma, type VoteChoice } from "@prisma/client"
import { ROUND_SIZE } from "@/lib/constants"
import { prisma } from "@/lib/prisma"
import type { RoundMovie, RoundResponse, VoteChoiceName } from "@/types/api"

const counterField = {
  WATCH_MANY: "watchManyCount",
  WATCH_ONCE: "onceEnoughCount",
  REMOVE: "removeFromIndustryCount",
} as const satisfies Record<VoteChoiceName, "watchManyCount" | "onceEnoughCount" | "removeFromIndustryCount">

type RoundMovieRow = RoundMovie

export async function getRound(userId: string): Promise<RoundResponse> {
  const movies = await prisma.$queryRaw<RoundMovieRow[]>(Prisma.sql`
    SELECT m.id, m.title, m."posterUrl", m."posterBlurhash"
    FROM "Movie" m
    WHERE NOT EXISTS (
      SELECT 1
      FROM "Vote" v
      WHERE v."movieId" = m.id
        AND v."userId" = ${userId}
    )
    ORDER BY random()
    LIMIT ${ROUND_SIZE}
  `)

  return { movies, finished: movies.length === 0 }
}

export async function submitVotes(userId: string, votes: { movieId: string; choice: VoteChoiceName }[]) {
  const movieIds = votes.map((vote) => vote.movieId)
  const movies = await prisma.movie.findMany({
    where: { id: { in: movieIds } },
    select: { id: true },
  })
  if (movies.length !== movieIds.length) {
    return { ok: false as const, status: 404 as const }
  }

  let processed = 0
  let skipped = 0

  await prisma.$transaction(async (tx) => {
    for (const vote of votes) {
      const existing = await tx.vote.findUnique({
        where: { userId_movieId: { userId, movieId: vote.movieId } },
      })
      if (existing) {
        skipped += 1
        continue
      }
      await tx.vote.create({
        data: {
          userId,
          movieId: vote.movieId,
          choice: vote.choice as VoteChoice,
        },
      })
      await tx.movie.update({
        where: { id: vote.movieId },
        data: { [counterField[vote.choice]]: { increment: 1 } },
      })
      processed += 1
    }
  })

  const next = await getRound(userId)
  return { ok: true as const, processed, skipped, next }
}
