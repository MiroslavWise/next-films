import { z } from "zod"
import { copy } from "@/lib/constants"
import { deleteStoredPhoto } from "@/lib/photos"
import { prisma } from "@/lib/prisma"
import type { FrameGuessEntryRecord, FrameGuessFrame } from "@/types/api"

const frameSchema = z.object({
  id: z.string().uuid({ version: "v7" }),
  url: z.url(),
  blurhash: z.string().min(6).max(200),
})

export const frameGuessFramesSchema = z.array(frameSchema)

export function parseFrames(raw: unknown): FrameGuessFrame[] {
  const parsed = frameGuessFramesSchema.safeParse(raw)
  return parsed.success ? parsed.data : []
}

function toEntry(
  entry: {
    id: string
    movieId: string
    frames: unknown
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  },
  movieTitle: string,
): FrameGuessEntryRecord {
  return {
    id: entry.id,
    movieId: entry.movieId,
    movieTitle,
    frames: parseFrames(entry.frames),
    isActive: entry.isActive,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

export async function getFrameGuessEntry(movieId: string) {
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    select: { id: true, title: true },
  })
  if (!movie) return { ok: false as const, status: 404, error: copy.notFound }

  const entry = await prisma.frameGuessEntry.findUnique({ where: { movieId } })
  if (!entry) {
    return {
      ok: true as const,
      entry: {
        id: null,
        movieId: movie.id,
        movieTitle: movie.title,
        frames: [] as FrameGuessFrame[],
        isActive: true,
        createdAt: null,
        updatedAt: null,
      } satisfies FrameGuessEntryRecord,
    }
  }

  return { ok: true as const, entry: toEntry(entry, movie.title) }
}

export async function setFrameGuessActive(movieId: string, isActive: boolean) {
  const movie = await prisma.movie.findUnique({ where: { id: movieId }, select: { id: true, title: true } })
  if (!movie) return { ok: false as const, status: 404, error: copy.notFound }

  const entry = await prisma.frameGuessEntry.upsert({
    where: { movieId },
    create: { movieId, frames: [], isActive },
    update: { isActive },
  })

  return { ok: true as const, entry: toEntry(entry, movie.title) }
}

export async function appendFrameGuessFrame(movieId: string, frame: FrameGuessFrame) {
  const movie = await prisma.movie.findUnique({ where: { id: movieId }, select: { id: true, title: true } })
  if (!movie) return { ok: false as const, status: 404, error: copy.notFound }

  const existing = await prisma.frameGuessEntry.findUnique({ where: { movieId } })
  const frames = existing ? parseFrames(existing.frames) : []
  frames.push(frame)

  const entry = existing
    ? await prisma.frameGuessEntry.update({
        where: { movieId },
        data: { frames },
      })
    : await prisma.frameGuessEntry.create({
        data: { movieId, frames, isActive: true },
      })

  return { ok: true as const, entry: toEntry(entry, movie.title), frame }
}

export async function removeFrameGuessFrame(movieId: string, frameId: string) {
  const movie = await prisma.movie.findUnique({ where: { id: movieId }, select: { id: true, title: true } })
  if (!movie) return { ok: false as const, status: 404, error: copy.notFound }

  const existing = await prisma.frameGuessEntry.findUnique({ where: { movieId } })
  if (!existing) return { ok: false as const, status: 404, error: copy.notFound }

  const frames = parseFrames(existing.frames)
  const target = frames.find((frame) => frame.id === frameId)
  if (!target) return { ok: false as const, status: 404, error: copy.notFound }

  const next = frames.filter((frame) => frame.id !== frameId)
  const entry = await prisma.frameGuessEntry.update({
    where: { movieId },
    data: { frames: next },
  })
  await deleteStoredPhoto(target.url)

  return { ok: true as const, entry: toEntry(entry, movie.title) }
}

export async function deleteFrameGuessBlobsForMovie(movieId: string) {
  const entry = await prisma.frameGuessEntry.findUnique({ where: { movieId } })
  if (!entry) return
  const frames = parseFrames(entry.frames)
  await Promise.all(frames.map((frame) => deleteStoredPhoto(frame.url)))
}
