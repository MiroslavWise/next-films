import { Prisma, type PlayoffStatus, type PlayoffTournament } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

export const PLAYOFF_SIZE = 32
export const PLAYOFF_FINAL_ROUND = 4
export const PLAYOFF_DONE_ROUND = 5

const playoffCounterByRound = {
  0: "playoffIn16Count",
  1: "playoffIn8Count",
  2: "playoffIn4Count",
  3: "playoffIn2Count",
  4: "playoffVictoryCount",
} as const satisfies Record<number, "playoffIn16Count" | "playoffIn8Count" | "playoffIn4Count" | "playoffIn2Count" | "playoffVictoryCount">

const uuid = z.string().uuid()

export const playoffMovieRefSchema = z.object({
  id: uuid,
  title: z.string().min(1),
  posterUrl: z.string().min(1),
  posterBlurhash: z.string().min(1),
})

export const playoffMatchSchema = z.object({
  id: z.string().min(1),
  roundIndex: z.number().int().min(0).max(PLAYOFF_FINAL_ROUND),
  slot: z.number().int().min(0),
  leftMovieId: uuid.nullable(),
  rightMovieId: uuid.nullable(),
  winnerMovieId: uuid.nullable(),
})

export const playoffBracketSchema = z.object({
  size: z.literal(PLAYOFF_SIZE),
  seedMovieIds: z.array(uuid).length(PLAYOFF_SIZE),
  movies: z.array(playoffMovieRefSchema).length(PLAYOFF_SIZE),
  matches: z.array(playoffMatchSchema).length(PLAYOFF_SIZE - 1),
})

export const playoffPickBodySchema = z.object({
  matchId: z.string().min(1),
  winnerMovieId: uuid,
  version: z.number().int().min(0),
})

export const playoffFinishBodySchema = z.object({
  action: z.enum(["home", "restart"]),
})

export type PlayoffMovieRef = z.infer<typeof playoffMovieRefSchema>
export type PlayoffMatch = z.infer<typeof playoffMatchSchema>
export type PlayoffBracket = z.infer<typeof playoffBracketSchema>
export type PlayoffPickBody = z.infer<typeof playoffPickBodySchema>
export type PlayoffFinishBody = z.infer<typeof playoffFinishBodySchema>

export type PlayoffMatchView = PlayoffMatch & {
  left: PlayoffMovieRef | null
  right: PlayoffMovieRef | null
}

export type PlayoffTournamentView = {
  id: string
  status: PlayoffStatus
  roundIndex: number
  version: number
  finalistMovieId: string | null
  bracket: PlayoffBracket
  currentMatch: PlayoffMatchView | null
  finalist: PlayoffMovieRef | null
  createdAt: string
  updatedAt: string
}

type MovieRow = {
  id: string
  title: string
  posterUrl: string
  posterBlurhash: string
}

function matchesInRound(roundIndex: number) {
  return PLAYOFF_SIZE / 2 / 2 ** roundIndex
}

function buildEmptyMatches(): PlayoffMatch[] {
  const matches: PlayoffMatch[] = []
  for (let roundIndex = 0; roundIndex <= PLAYOFF_FINAL_ROUND; roundIndex += 1) {
    const count = matchesInRound(roundIndex)
    for (let slot = 0; slot < count; slot += 1) {
      matches.push({
        id: `r${roundIndex}-m${slot}`,
        roundIndex,
        slot,
        leftMovieId: null,
        rightMovieId: null,
        winnerMovieId: null,
      })
    }
  }
  return matches
}

function buildBracket(movies: MovieRow[]): PlayoffBracket {
  const seedMovieIds = movies.map((movie) => movie.id)
  const matches = buildEmptyMatches()

  for (let slot = 0; slot < matchesInRound(0); slot += 1) {
    const match = matches.find((item) => item.roundIndex === 0 && item.slot === slot)
    if (!match) continue
    match.leftMovieId = seedMovieIds[slot * 2] ?? null
    match.rightMovieId = seedMovieIds[slot * 2 + 1] ?? null
  }

  return {
    size: PLAYOFF_SIZE,
    seedMovieIds,
    movies: movies.map((movie) => ({
      id: movie.id,
      title: movie.title,
      posterUrl: movie.posterUrl,
      posterBlurhash: movie.posterBlurhash,
    })),
    matches,
  }
}

function parseBracket(value: Prisma.JsonValue): PlayoffBracket {
  return playoffBracketSchema.parse(value)
}

function movieMap(bracket: PlayoffBracket) {
  return new Map(bracket.movies.map((movie) => [movie.id, movie]))
}

function toMatchView(match: PlayoffMatch, movies: Map<string, PlayoffMovieRef>): PlayoffMatchView {
  return {
    ...match,
    left: match.leftMovieId ? (movies.get(match.leftMovieId) ?? null) : null,
    right: match.rightMovieId ? (movies.get(match.rightMovieId) ?? null) : null,
  }
}

function findCurrentMatch(bracket: PlayoffBracket, roundIndex: number, status: PlayoffStatus): PlayoffMatchView | null {
  if (status !== "GAME") return null
  const movies = movieMap(bracket)
  const open = bracket.matches
    .filter((match) => match.roundIndex === roundIndex && !match.winnerMovieId && match.leftMovieId && match.rightMovieId)
    .sort((a, b) => a.slot - b.slot)[0]
  return open ? toMatchView(open, movies) : null
}

function toView(row: PlayoffTournament): PlayoffTournamentView {
  const bracket = parseBracket(row.bracket)
  const movies = movieMap(bracket)
  const finalist = row.finalistMovieId ? (movies.get(row.finalistMovieId) ?? null) : null

  return {
    id: row.id,
    status: row.status,
    roundIndex: row.roundIndex,
    version: row.version,
    finalistMovieId: row.finalistMovieId,
    bracket,
    currentMatch: findCurrentMatch(bracket, row.roundIndex, row.status),
    finalist,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const activeStatuses: PlayoffStatus[] = ["GAME", "PRE_END"]

export async function getCurrentTournament(userId: string) {
  const row = await prisma.playoffTournament.findFirst({
    where: { userId, status: { in: activeStatuses } },
    orderBy: { updatedAt: "desc" },
  })
  if (!row) return null
  return toView(row)
}

async function createTournamentRow(userId: string) {
  const movies = await prisma.$queryRaw<MovieRow[]>(Prisma.sql`
    SELECT m.id, m.title, m."posterUrl", m."posterBlurhash"
    FROM "Movie" m
    ORDER BY random()
    LIMIT ${PLAYOFF_SIZE}
  `)

  if (movies.length < PLAYOFF_SIZE) {
    return { ok: false as const, reason: "insufficient" as const, available: movies.length }
  }

  const bracket = buildBracket(movies)
  const row = await prisma.playoffTournament.create({
    data: {
      userId,
      status: "GAME",
      roundIndex: 0,
      bracket,
      version: 0,
    },
  })

  return { ok: true as const, tournament: toView(row) }
}

export async function getOrCreateTournament(userId: string) {
  const existing = await getCurrentTournament(userId)
  if (existing) return { ok: true as const, tournament: existing, resumed: true as const }

  const created = await createTournamentRow(userId)
  if (!created.ok) return created
  return { ok: true as const, tournament: created.tournament, resumed: false as const }
}

function advanceRound(bracket: PlayoffBracket, roundIndex: number) {
  const roundMatches = bracket.matches
    .filter((match) => match.roundIndex === roundIndex)
    .sort((a, b) => a.slot - b.slot)

  if (roundMatches.some((match) => !match.winnerMovieId)) return false

  if (roundIndex >= PLAYOFF_FINAL_ROUND) return true

  const nextRound = roundIndex + 1
  for (let slot = 0; slot < matchesInRound(nextRound); slot += 1) {
    const next = bracket.matches.find((match) => match.roundIndex === nextRound && match.slot === slot)
    if (!next) continue
    next.leftMovieId = roundMatches[slot * 2]?.winnerMovieId ?? null
    next.rightMovieId = roundMatches[slot * 2 + 1]?.winnerMovieId ?? null
  }

  return true
}

export async function applyPick(userId: string, tournamentId: string, body: PlayoffPickBody) {
  const row = await prisma.playoffTournament.findFirst({
    where: { id: tournamentId, userId },
  })
  if (!row) return { ok: false as const, status: 404 as const }
  if (row.status !== "GAME") return { ok: false as const, status: 400 as const, error: "game_not_active" as const }
  if (row.version !== body.version) return { ok: false as const, status: 409 as const, error: "version_conflict" as const }

  const bracket = parseBracket(row.bracket)
  const match = bracket.matches.find((item) => item.id === body.matchId)
  if (!match) return { ok: false as const, status: 400 as const, error: "match_not_found" as const }
  if (match.roundIndex !== row.roundIndex) return { ok: false as const, status: 400 as const, error: "wrong_round" as const }
  if (match.winnerMovieId) return { ok: false as const, status: 400 as const, error: "already_picked" as const }
  if (!match.leftMovieId || !match.rightMovieId) return { ok: false as const, status: 400 as const, error: "match_not_ready" as const }
  if (body.winnerMovieId !== match.leftMovieId && body.winnerMovieId !== match.rightMovieId) {
    return { ok: false as const, status: 400 as const, error: "invalid_winner" as const }
  }

  match.winnerMovieId = body.winnerMovieId

  let nextRoundIndex = row.roundIndex
  let nextStatus: PlayoffStatus = "GAME"
  let finalistMovieId: string | null = null

  const roundComplete = advanceRound(bracket, row.roundIndex)
  if (roundComplete) {
    if (row.roundIndex >= PLAYOFF_FINAL_ROUND) {
      nextStatus = "PRE_END"
      nextRoundIndex = PLAYOFF_DONE_ROUND
      finalistMovieId = body.winnerMovieId
    } else {
      nextRoundIndex = row.roundIndex + 1
    }
  }

  const counterField = playoffCounterByRound[match.roundIndex as keyof typeof playoffCounterByRound]

  const fresh = await prisma.$transaction(async (tx) => {
    const updated = await tx.playoffTournament.updateMany({
      where: { id: tournamentId, userId, version: body.version, status: "GAME" },
      data: {
        bracket,
        roundIndex: nextRoundIndex,
        status: nextStatus,
        finalistMovieId,
        version: { increment: 1 },
      },
    })
    if (updated.count === 0) return null

    if (counterField) {
      await tx.movie.update({
        where: { id: body.winnerMovieId },
        data: { [counterField]: { increment: 1 } },
      })
    }

    return tx.playoffTournament.findFirst({ where: { id: tournamentId, userId } })
  })

  if (!fresh) return { ok: false as const, status: 409 as const, error: "version_conflict" as const }
  return { ok: true as const, tournament: toView(fresh) }
}

export async function finishTournament(userId: string, tournamentId: string, action: PlayoffFinishBody["action"]) {
  const row = await prisma.playoffTournament.findFirst({
    where: { id: tournamentId, userId },
  })
  if (!row) return { ok: false as const, status: 404 as const }
  if (row.status !== "PRE_END") return { ok: false as const, status: 400 as const, error: "not_pre_end" as const }

  const ended = await prisma.playoffTournament.updateMany({
    where: { id: tournamentId, userId, status: "PRE_END" },
    data: { status: "END", version: { increment: 1 } },
  })
  if (ended.count === 0) return { ok: false as const, status: 409 as const, error: "version_conflict" as const }

  if (action === "home") {
    return { ok: true as const, action: "home" as const, tournament: null }
  }

  const created = await createTournamentRow(userId)
  if (!created.ok) return { ok: false as const, status: 400 as const, error: "insufficient" as const, available: created.available }
  return { ok: true as const, action: "restart" as const, tournament: created.tournament }
}
