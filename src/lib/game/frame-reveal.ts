import { Prisma, type FrameRevealRound, type FrameRevealSession } from "@prisma/client"
import { z } from "zod"
import { parseFrames } from "@/lib/frame-guess"
import { getFrameGuessAvailability } from "@/lib/game/frame-guess"
import { prisma } from "@/lib/prisma"
import { uuidv7 } from "@/lib/uuid"

export const REVEAL_COLS = 16
export const REVEAL_ROWS = 9
export const REVEAL_CELLS = REVEAL_COLS * REVEAL_ROWS
export const FRAME_REVEAL_OPTIONS = 4
export const FRAME_REVEAL_DISTRACTORS = FRAME_REVEAL_OPTIONS - 1
const HISTORY_LIMIT = 50

const uuid = z.string().uuid()

export const frameRevealAnswerBodySchema = z.object({
  movieId: uuid,
})

export const frameRevealFinishBodySchema = z.object({
  action: z.enum(["home", "restart"]),
})

const openedCellsSchema = z
  .array(z.number().int().min(0).max(REVEAL_CELLS - 1))
  .min(1)
  .max(REVEAL_CELLS)
  .refine((cells) => new Set(cells).size === cells.length, { message: "duplicate cells" })

export type FrameRevealOption = {
  movieId: string
  title: string
}

export type FrameRevealRoundPublic = {
  id: string
  imageUrl: string
  imageBlurhash: string
  cols: number
  rows: number
  openedCells: number[]
  revealCount: number
  canRevealMore: boolean
  options: FrameRevealOption[]
}

export type FrameRevealRoundAnswered = FrameRevealRoundPublic & {
  chosenMovieId: string
  isCorrect: boolean
  correctMovieId: string
  correctTitle: string
  answeredAt: string
}

export type FrameRevealSessionView = {
  id: string
  status: "ACTIVE" | "ENDED"
  correctCount: number
  answeredCount: number
  createdAt: string
  updatedAt: string
  endedAt: string | null
  currentRound: FrameRevealRoundPublic | null
}

export type FrameRevealHistoryItem = {
  id: string
  createdAt: string
  endedAt: string | null
  correctCount: number
  answeredCount: number
  preview: { imageUrl: string; imageBlurhash: string } | null
}

export type FrameRevealSessionDetail = FrameRevealSessionView & {
  rounds: FrameRevealRoundAnswered[]
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

function parseOptions(raw: Prisma.JsonValue): FrameRevealOption[] {
  return z.array(z.object({ movieId: uuid, title: z.string().min(1) })).parse(raw)
}

function parseOpenedCells(raw: Prisma.JsonValue, cols: number, rows: number): number[] {
  const max = cols * rows - 1
  const parsed = z
    .array(z.number().int().min(0).max(Math.max(max, 0)))
    .min(1)
    .safeParse(raw)
  if (!parsed.success) return [0]
  const unique = [...new Set(parsed.data)].filter((cell) => cell <= max)
  return unique.length > 0 ? unique : [0]
}

function randomClosedCell(opened: number[], cells: number): number | null {
  if (opened.length >= cells) return null
  const open = new Set(opened)
  const closed: number[] = []
  for (let i = 0; i < cells; i += 1) {
    if (!open.has(i)) closed.push(i)
  }
  if (closed.length === 0) return null
  return closed[Math.floor(Math.random() * closed.length)]!
}

function toRoundPublic(row: FrameRevealRound): FrameRevealRoundPublic {
  const openedCells = parseOpenedCells(row.openedCells, row.cols, row.rows)
  const cells = row.cols * row.rows
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    imageBlurhash: row.imageBlurhash,
    cols: row.cols,
    rows: row.rows,
    openedCells,
    revealCount: row.revealCount,
    canRevealMore: openedCells.length < cells,
    options: parseOptions(row.options),
  }
}

function toRoundAnswered(row: FrameRevealRound): FrameRevealRoundAnswered | null {
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

function toSessionView(row: FrameRevealSession, currentRound: FrameRevealRound | null): FrameRevealSessionView {
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
    LIMIT ${FRAME_REVEAL_DISTRACTORS}
  `
}

async function createRoundRow(session: FrameRevealSession) {
  const prior = await prisma.frameRevealRound.findMany({
    where: { sessionId: session.id },
    select: { frameId: true },
  })
  const picked = await pickEntryAndFrame(prior.map((row) => row.frameId))
  if (!picked) return { ok: false as const, reason: "insufficient" as const }

  const distractors = await pickDistractors(picked.entry.movieId)
  if (distractors.length < FRAME_REVEAL_DISTRACTORS) {
    return { ok: false as const, reason: "insufficient" as const }
  }

  const options = shuffle([
    { movieId: picked.entry.movieId, title: picked.entry.title },
    ...distractors.map((movie) => ({ movieId: movie.id, title: movie.title })),
  ])

  const firstCell = Math.floor(Math.random() * REVEAL_CELLS)
  const openedCells = [firstCell]
  openedCellsSchema.parse(openedCells)

  const round = await prisma.frameRevealRound.create({
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
      cols: REVEAL_COLS,
      rows: REVEAL_ROWS,
      openedCells,
      revealCount: 0,
    },
  })

  return { ok: true as const, round }
}

async function getOpenRound(sessionId: string) {
  return prisma.frameRevealRound.findFirst({
    where: { sessionId, answeredAt: null },
    orderBy: { createdAt: "desc" },
  })
}

async function ensureOpenRound(session: FrameRevealSession) {
  const open = await getOpenRound(session.id)
  if (open) return { ok: true as const, round: open, session }

  const created = await createRoundRow(session)
  if (!created.ok) return created
  return { ok: true as const, round: created.round, session }
}

export async function getCurrentRevealSession(userId: string) {
  const row = await prisma.frameRevealSession.findFirst({
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

export async function getOrCreateRevealSession(userId: string) {
  const current = await getCurrentRevealSession(userId)
  if (current) {
    if (!current.ok) return current
    return { ok: true as const, session: current.session, resumed: true as const }
  }

  const availability = await getFrameGuessAvailability()
  if (!availability.ok) {
    return { ok: false as const, reason: "insufficient" as const, available: availability }
  }

  const row = await prisma.frameRevealSession.create({
    data: { userId, status: "ACTIVE" },
  })
  const ensured = await ensureOpenRound(row)
  if (!ensured.ok) {
    await prisma.frameRevealSession.delete({ where: { id: row.id } })
    return { ok: false as const, reason: "insufficient" as const, available: availability }
  }

  return { ok: true as const, session: toSessionView(ensured.session, ensured.round), resumed: false as const }
}

export async function listEndedRevealSessions(userId: string): Promise<FrameRevealHistoryItem[]> {
  const rows = await prisma.frameRevealSession.findMany({
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

export async function getRevealSessionForUser(userId: string, sessionId: string): Promise<FrameRevealSessionDetail | null> {
  const row = await prisma.frameRevealSession.findFirst({
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
  const answered = row.rounds.map(toRoundAnswered).filter((item): item is FrameRevealRoundAnswered => item != null)

  return {
    ...toSessionView(row, open),
    rounds: answered,
  }
}

export async function revealCell(userId: string, roundId: string) {
  const round = await prisma.frameRevealRound.findFirst({
    where: { id: roundId, userId },
    include: { session: true },
  })
  if (!round) return { ok: false as const, status: 404 as const }
  if (round.session.status !== "ACTIVE") return { ok: false as const, status: 400 as const, error: "session_not_active" as const }
  if (round.answeredAt) return { ok: false as const, status: 400 as const, error: "already_answered" as const }

  const opened = parseOpenedCells(round.openedCells, round.cols, round.rows)
  const cells = round.cols * round.rows
  const next = randomClosedCell(opened, cells)
  if (next == null) {
    return { ok: true as const, round: toRoundPublic(round) }
  }

  const openedCells = [...opened, next]
  const revealCount = openedCells.length - 1

  const updated = await prisma.frameRevealRound.updateMany({
    where: { id: roundId, userId, answeredAt: null },
    data: { openedCells, revealCount },
  })
  if (updated.count === 0) return { ok: false as const, status: 409 as const, error: "conflict" as const }

  const fresh = await prisma.frameRevealRound.findFirstOrThrow({ where: { id: roundId } })
  return { ok: true as const, round: toRoundPublic(fresh) }
}

export async function submitRevealAnswer(userId: string, roundId: string, movieId: string) {
  const round = await prisma.frameRevealRound.findFirst({
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
    const locked = await tx.frameRevealRound.updateMany({
      where: { id: roundId, userId, answeredAt: null },
      data: {
        chosenMovieId: movieId,
        isCorrect,
        answeredAt,
      },
    })
    if (locked.count === 0) return null

    await tx.frameRevealSession.update({
      where: { id: round.sessionId },
      data: {
        answeredCount: { increment: 1 },
        ...(isCorrect ? { correctCount: { increment: 1 } } : {}),
      },
    })

    const freshRound = await tx.frameRevealRound.findFirstOrThrow({ where: { id: roundId } })
    const freshSession = await tx.frameRevealSession.findFirstOrThrow({ where: { id: round.sessionId } })
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

export async function finishRevealSession(userId: string, sessionId: string, action: "home" | "restart") {
  const row = await prisma.frameRevealSession.findFirst({
    where: { id: sessionId, userId },
  })
  if (!row) return { ok: false as const, status: 404 as const }
  if (row.status !== "ACTIVE") return { ok: false as const, status: 400 as const, error: "not_active" as const }

  await prisma.frameRevealRound.deleteMany({
    where: { sessionId, answeredAt: null },
  })

  if (row.answeredCount === 0) {
    await prisma.frameRevealSession.delete({ where: { id: sessionId } })
    if (action === "home") return { ok: true as const, action: "home" as const, session: null }
    const created = await getOrCreateRevealSession(userId)
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

  const ended = await prisma.frameRevealSession.updateMany({
    where: { id: sessionId, userId, status: "ACTIVE" },
    data: { status: "ENDED", endedAt: new Date() },
  })
  if (ended.count === 0) return { ok: false as const, status: 409 as const, error: "conflict" as const }

  if (action === "home") {
    return { ok: true as const, action: "home" as const, session: null }
  }

  const created = await getOrCreateRevealSession(userId)
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
