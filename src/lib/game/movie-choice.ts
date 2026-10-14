import { Prisma } from "@prisma/client"
import { ROUND_SIZE } from "@/lib/constants"
import { prisma } from "@/lib/prisma"
import { VoteChoiceName, type RoundMovie, type RoundResponse } from "@/types/api"

const counterField = {
  [VoteChoiceName.WATCH_MANY]: "watchManyCount",
  [VoteChoiceName.WATCH_ONCE]: "onceEnoughCount",
  [VoteChoiceName.REMOVE]: "removeFromIndustryCount",
} as const satisfies Record<VoteChoiceName, "watchManyCount" | "onceEnoughCount" | "removeFromIndustryCount">

type RoundMovieRow = RoundMovie

export async function getRound(_userId: string): Promise<RoundResponse> {
  const movies = await prisma.$queryRaw<RoundMovieRow[]>(Prisma.sql`
    SELECT m.id, m.title, m."posterUrl", m."posterBlurhash"
    FROM "Movie" m
    ORDER BY random()
    LIMIT ${ROUND_SIZE}
  `)

  return { movies, finished: movies.length < ROUND_SIZE }
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

  await prisma.$transaction(
    votes.map((vote) =>
      prisma.movie.update({
        where: { id: vote.movieId },
        data: { [counterField[vote.choice]]: { increment: 1 } },
      }),
    ),
  )

  const next = await getRound(userId)
  return { ok: true as const, processed: votes.length, skipped: 0, next }
}
