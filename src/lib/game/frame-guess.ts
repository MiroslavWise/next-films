import { Prisma, type FrameGuessRound, type FrameGuessSession } from "@prisma/client"
import { z } from "zod"
import { parseFrames } from "@/lib/frame-guess"
import { prisma } from "@/lib/prisma"
import { uuidv7 } from "@/lib/uuid"

export const FRAME_GUESS_OPTIONS = 4
export const FRAME_GUESS_DISTRACTORS = FRAME_GUESS_OPTIONS - 1
const HISTORY_LIMIT = 50

const uuid = z.string().uuid()

export const frameGuessAnswerBodySchema = z.object({
  movieId: uuid,
})

export const frameGuessFinishBodySchema = z.object({
  action: z.enum(["home", "restart"]),
})

export type FrameGuessOption = {
  movieId: string
  title: string
}

export type FrameGuessRoundPublic = {
  id: string
  imageUrl: string
  imageBlurhash: string
  options: FrameGuessOption[]
}

export type FrameGuessRoundAnswered = FrameGuessRoundPublic & {
  chosenMovieId: string
  isCorrect: boolean
  correctMovieId: string
  correctTitle: string
  answeredAt: string
}

export type FrameGuessSessionView = {
  id: string
  status: "ACTIVE" | "ENDED"
  correctCount: number
  answeredCount: number
  createdAt: string
  updatedAt: string
  endedAt: string | null
  currentRound: FrameGuessRoundPublic | null
}

export type FrameGuessHistoryItem = {
  id: string
  createdAt: string
  endedAt: string | null
  correctCount: number
  answeredCount: number
  preview: { imageUrl: string; imageBlurhash: string } | null
}

export type FrameGuessSessionDetail = FrameGuessSessionView & {
  rounds: FrameGuessRoundAnswered[]
}

type EntryRow = {
  id: string
  movieId: string
  frames: Prisma.JsonValue
  title: string
}

type MovieRow = {
  id: string
  title: string
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = next[i]!
    next[i] = next[j]!
    next[j] = tmp
  }
  return next
}

function parseOptions(raw: Prisma.JsonValue): FrameGuessOption[] {
  return z
    .array(z.object({ movieId: uuid, title: z.string().min(1) }))
    .parse(raw)
}

function toRoundPublic(row: FrameGuessRound): FrameGuessRoundPublic {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    imageBlurhash: row.imageBlurhash,
    options: parseOptions(row.options),
  }
}

function toRoundAnswered(row: FrameGuessRound): FrameGuessRoundAnswered | null {
  if (!row.answeredAt || !row.chosenMovieId || row.isCorrect == null) return null
  return {
    ...toRoundPublic(row),
    chosenMovieId: row.chosenMovieId,
    isCorrect: row.isCorrect,
    correctMovieId: row.correctMovieId,
    correctTitle: row.correctTitle,
    answeredAt: row.answeredAt.toISOString(),
  }
}

function toSessionView(row: FrameGuessSession, currentRound: FrameGuessRound | null): FrameGuessSessionView {
  return {
    id: row.id,
    status: row.status,
    correctCount: row.correctCount,
    answeredCount: row.answeredCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    currentRound: currentRound && !currentRound.answeredAt ? toRoundPublic(currentRound) : null,
  }
}

async function countPlayableCatalog() {
  const [entries, movies] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "FrameGuessEntry"
      WHERE "isActive" = true
        AND jsonb_array_length("frames") > 0
    `,
    prisma.movie.count(),
  ])
  return {
    entries: Number(entries[0]?.count ?? 0),
    movies,
  }
}

export async function getFrameGuessAvailability() {
  const { entries, movies } = await countPlayableCatalog()
  return {
    ok: entries >= 1 && movies >= FRAME_GUESS_OPTIONS,
    entries,
    movies,
  }
}

async function pickEntryAndFrame(excludeFrameIds: string[]) {
  const entries = await prisma.$queryRaw<EntryRow[]>`
    SELECT e.id, e."movieId", e.frames, m.title
    FROM "FrameGuessEntry" e
    JOIN "Movie" m ON m.id = e."movieId"
    WHERE e."isActive" = true
      AND jsonb_array_length(e.frames) > 0
    ORDER BY random()
    LIMIT 12
  `
  if (entries.length === 0) return null

  const exclude = new Set(excludeFrameIds)
  for (const entry of shuffle(entries)) {
    const frames = parseFrames(entry.frames)
    const fresh = frames.filter((frame) => !exclude.has(frame.id))
    const pool = fresh.length > 0 ? fresh : frames
    if (pool.length === 0) continue
    const frame = pool[Math.floor(Math.random() * pool.length)]!
    return { entry, frame }
  }
  return null
}

async function pickDistractors(correctMovieId: string) {
  return prisma.$queryRaw<MovieRow[]>`
    SELECT id, title
    FROM "Movie"
    WHERE id <> ${correctMovieId}::uuid
    ORDER BY random()
    LIMIT ${FRAME_GUESS_DISTRACTORS}
  `
}

async function createRoundRow(session: FrameGuessSession) {
  const prior = await prisma.frameGuessRound.findMany({
    where: { sessionId: session.id },
    select: { frameId: true },
  })
  const picked = await pickEntryAndFrame(prior.map((row) => row.frameId))
  if (!picked) return { ok: false as const, reason: "insufficient" as const }

  const distractors = await pickDistractors(picked.entry.movieId)
  if (distractors.length < FRAME_GUESS_DISTRACTORS) {
    return { ok: false as const, reason: "insufficient" as const }
  }

  const options = shuffle([
    { movieId: picked.entry.movieId, title: picked.entry.title },
    ...distractors.map((movie) => ({ movieId: movie.id, title: movie.title })),
  ])

  const round = await prisma.frameGuessRound.create({
    data: {
      id: uuidv7(),
      sessionId: session.id,
      userId: session.userId,
      frameId: picked.frame.id,
      imageUrl: picked.frame.url,
      imageBlurhash: picked.frame.blurhash,
      correctMovieId: picked.entry.movieId,
      correctTitle: picked.entry.title,
      options,
    },
  })

  return { ok: true as const, round }
}

async function getOpenRound(sessionId: string) {
  return prisma.frameGuessRound.findFirst({
    where: { sessionId, answeredAt: null },
    orderBy: { createdAt: "desc" },
  })
}

async function ensureOpenRound(session: FrameGuessSession) {
  const open = await getOpenRound(session.id)
  if (open) return { ok: true as const, round: open, session }

  const created = await createRoundRow(session)
  if (!created.ok) return created
  return { ok: true as const, round: created.round, session }
}

export async function getCurrentSession(userId: string) {
  const row = await prisma.frameGuessSession.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  })
  if (!row) return null

  const ensured = await ensureOpenRound(row)
  if (!ensured.ok) {
    const available = await getFrameGuessAvailability()
    return { ok: false as const, reason: "insufficient" as const, available, session: toSessionView(row, null) }
  }
  return { ok: true as const, session: toSessionView(ensured.session, ensured.round) }
}

export async function getOrCreateSession(userId: string) {
  const current = await getCurrentSession(userId)
  if (current) {
    if (!current.ok) return current
    return { ok: true as const, session: current.session, resumed: true as const }
  }

  const availability = await getFrameGuessAvailability()
  if (!availability.ok) {
    return { ok: false as const, reason: "insufficient" as const, available: availability }
  }

  const row = await prisma.frameGuessSession.create({
    data: { userId, status: "ACTIVE" },
  })
  const ensured = await ensureOpenRound(row)
  if (!ensured.ok) {
    await prisma.frameGuessSession.delete({ where: { id: row.id } })
    return { ok: false as const, reason: "insufficient" as const, available: availability }
  }

  return { ok: true as const, session: toSessionView(ensured.session, ensured.round), resumed: false as const }
}

export async function listEndedSessions(userId: string): Promise<FrameGuessHistoryItem[]> {
  const rows = await prisma.frameGuessSession.findMany({
    where: { userId, status: "ENDED" },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    include: {
      rounds: {
        where: { answeredAt: { not: null } },
        orderBy: { answeredAt: "desc" },
        take: 1,
        select: { imageUrl: true, imageBlurhash: true },
      },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    correctCount: row.correctCount,
    answeredCount: row.answeredCount,
    preview: row.rounds[0]
      ? { imageUrl: row.rounds[0].imageUrl, imageBlurhash: row.rounds[0].imageBlurhash }
      : null,
  }))
}

export async function getSessionForUser(userId: string, sessionId: string): Promise<FrameGuessSessionDetail | null> {
  const row = await prisma.frameGuessSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      rounds: {
        where: { answeredAt: { not: null } },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!row) return null

  const open = row.status === "ACTIVE" ? await getOpenRound(row.id) : null
  const answered = row.rounds.map(toRoundAnswered).filter((item): item is FrameGuessRoundAnswered => item != null)

  return {
    ...toSessionView(row, open),
    rounds: answered,
  }
}

export async function submitAnswer(userId: string, roundId: string, movieId: string) {
  const round = await prisma.frameGuessRound.findFirst({
    where: { id: roundId, userId },
    include: { session: true },
  })
  if (!round) return { ok: false as const, status: 404 as const }
  if (round.session.status !== "ACTIVE") return { ok: false as const, status: 400 as const, error: "session_not_active" as const }
  if (round.answeredAt) return { ok: false as const, status: 400 as const, error: "already_answered" as const }

  const options = parseOptions(round.options)
  if (!options.some((option) => option.movieId === movieId)) {
    return { ok: false as const, status: 400 as const, error: "invalid_option" as const }
  }

  const isCorrect = movieId === round.correctMovieId
  const answeredAt = new Date()

  const updated = await prisma.$transaction(async (tx) => {
    const locked = await tx.frameGuessRound.updateMany({
      where: { id: roundId, userId, answeredAt: null },
      data: {
        chosenMovieId: movieId,
        isCorrect,
        answeredAt,
      },
    })
    if (locked.count === 0) return null

    await tx.frameGuessSession.update({
      where: { id: round.sessionId },
      data: {
        answeredCount: { increment: 1 },
        ...(isCorrect ? { correctCount: { increment: 1 } } : {}),
      },
    })

    const freshRound = await tx.frameGuessRound.findFirstOrThrow({ where: { id: roundId } })
    const freshSession = await tx.frameGuessSession.findFirstOrThrow({ where: { id: round.sessionId } })
    return { freshRound, freshSession }
  })

  if (!updated) return { ok: false as const, status: 409 as const, error: "already_answered" as const }

  const answered = toRoundAnswered(updated.freshRound)
  if (!answered) return { ok: false as const, status: 500 as const, error: "internal" as const }

  const next = await createRoundRow(updated.freshSession)
  if (!next.ok) {
    return {
      ok: true as const,
      session: toSessionView(updated.freshSession, null),
      answered,
      nextRound: null,
      insufficientNext: true as const,
    }
  }

  return {
    ok: true as const,
    session: toSessionView(updated.freshSession, next.round),
    answered,
    nextRound: toRoundPublic(next.round),
    insufficientNext: false as const,
  }
}

export async function finishSession(userId: string, sessionId: string, action: "home" | "restart") {
  const row = await prisma.frameGuessSession.findFirst({
    where: { id: sessionId, userId },
  })
  if (!row) return { ok: false as const, status: 404 as const }
  if (row.status !== "ACTIVE") return { ok: false as const, status: 400 as const, error: "not_active" as const }

  // незавершённый открытый раунд просто удаляем — в историю не попадает
  await prisma.frameGuessRound.deleteMany({
    where: { sessionId, answeredAt: null },
  })

  if (row.answeredCount === 0) {
    await prisma.frameGuessSession.delete({ where: { id: sessionId } })
    if (action === "home") return { ok: true as const, action: "home" as const, session: null }
    const created = await getOrCreateSession(userId)
    if (!created.ok) {
      return {
        ok: false as const,
        status: 400 as const,
        error: "insufficient" as const,
        available: created.available ?? (await getFrameGuessAvailability()),
      }
    }
    return { ok: true as const, action: "restart" as const, session: created.session }
  }

  const ended = await prisma.frameGuessSession.updateMany({
    where: { id: sessionId, userId, status: "ACTIVE" },
    data: { status: "ENDED", endedAt: new Date() },
  })
  if (ended.count === 0) return { ok: false as const, status: 409 as const, error: "conflict" as const }

  if (action === "home") {
    return { ok: true as const, action: "home" as const, session: null }
  }

  const created = await getOrCreateSession(userId)
  if (!created.ok) {
    return {
      ok: false as const,
      status: 400 as const,
      error: "insufficient" as const,
      available: created.available ?? (await getFrameGuessAvailability()),
    }
  }
  return { ok: true as const, action: "restart" as const, session: created.session }
}
