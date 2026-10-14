import { Prisma } from "@prisma/client";
import { copy } from "@/lib/constants";
import { nameKey } from "@/lib/names";
import { deleteStoredPhoto } from "@/lib/photos";
import { prisma } from "@/lib/prisma";
import type { PersonKind } from "@/lib/validators";
import type { MovieRecord, PersonRecord } from "@/types/api";

const movieInclude = {
  genres: { include: { genre: true } },
  actors: { include: { actor: true } },
  directors: { include: { director: true } },
  producers: { include: { producer: true } },
} satisfies Prisma.MovieInclude;

type MovieWithRelations = Prisma.MovieGetPayload<{ include: typeof movieInclude }>;

export function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isForeignKeyError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

function toPerson(person: {
  id: string;
  name: string;
  photoUrl: string | null;
  photoBlurhash: string | null;
}): PersonRecord {
  return {
    id: person.id,
    name: person.name,
    photoUrl: person.photoUrl,
    photoBlurhash: person.photoBlurhash,
  };
}

function toMovie(movie: MovieWithRelations): MovieRecord {
  return {
    id: movie.id,
    title: movie.title,
    posterUrl: movie.posterUrl,
    posterBlurhash: movie.posterBlurhash,
    watchManyCount: movie.watchManyCount,
    onceEnoughCount: movie.onceEnoughCount,
    removeFromIndustryCount: movie.removeFromIndustryCount,
    playoffIn16Count: movie.playoffIn16Count,
    playoffIn8Count: movie.playoffIn8Count,
    playoffIn4Count: movie.playoffIn4Count,
    playoffIn2Count: movie.playoffIn2Count,
    playoffVictoryCount: movie.playoffVictoryCount,
    genres: movie.genres.map((link) => ({ id: link.genre.id, name: link.genre.name })),
    actors: movie.actors.map((link) => toPerson(link.actor)),
    directors: movie.directors.map((link) => toPerson(link.director)),
    producers: movie.producers.map((link) => toPerson(link.producer)),
  };
}

export async function listMovies(options?: { page?: number; pageSize?: number }) {
  const pageSize = Math.min(Math.max(options?.pageSize ?? 20, 1), 100)
  const page = Math.max(options?.page ?? 1, 1)
  const skip = (page - 1) * pageSize

  const [total, movies] = await Promise.all([
    prisma.movie.count(),
    prisma.movie.findMany({
      include: movieInclude,
      orderBy: { title: "asc" },
      skip,
      take: pageSize,
    }),
  ])

  return {
    movies: movies.map(toMovie),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getMovie(id: string) {
  const movie = await prisma.movie.findUnique({ where: { id }, include: movieInclude })
  if (!movie) return { ok: false as const, status: 404, error: copy.notFound }
  return { ok: true as const, movie: toMovie(movie) }
}

type MovieInput = {
  id?: string
  title: string
  posterUrl: string
  posterBlurhash: string
  genreIds: string[]
  actorIds: string[]
  directorIds: string[]
  producerIds: string[]
}

export async function createMovie(input: MovieInput) {
  try {
    const movie = await prisma.$transaction(async (tx) => {
      const created = await tx.movie.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          title: input.title,
          posterUrl: input.posterUrl,
          posterBlurhash: input.posterBlurhash,
        },
      })
      if (input.genreIds.length > 0) {
        await tx.movieGenre.createMany({
          data: input.genreIds.map((genreId) => ({ movieId: created.id, genreId })),
        });
      }
      if (input.actorIds.length > 0) {
        await tx.movieActor.createMany({
          data: input.actorIds.map((actorId) => ({ movieId: created.id, actorId })),
        });
      }
      if (input.directorIds.length > 0) {
        await tx.movieDirector.createMany({
          data: input.directorIds.map((directorId) => ({ movieId: created.id, directorId })),
        });
      }
      if (input.producerIds.length > 0) {
        await tx.movieProducer.createMany({
          data: input.producerIds.map((producerId) => ({ movieId: created.id, producerId })),
        });
      }
      return created;
    });
    const full = await prisma.movie.findUniqueOrThrow({ where: { id: movie.id }, include: movieInclude });
    return { ok: true as const, movie: toMovie(full) };
  } catch (error) {
    if (isUniqueError(error)) return { ok: false as const, status: 409, error: copy.admin.duplicate };
    if (isForeignKeyError(error)) return { ok: false as const, status: 400, error: copy.validation };
    throw error;
  }
}

export async function updateMovie(id: string, input: MovieInput) {
  const current = await prisma.movie.findUnique({ where: { id } });
  if (!current) return { ok: false as const, status: 404, error: copy.notFound };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.movie.update({
        where: { id },
        data: {
          title: input.title,
          posterUrl: input.posterUrl,
          posterBlurhash: input.posterBlurhash,
        },
      });
      await tx.movieGenre.deleteMany({ where: { movieId: id } });
      await tx.movieActor.deleteMany({ where: { movieId: id } });
      await tx.movieDirector.deleteMany({ where: { movieId: id } });
      await tx.movieProducer.deleteMany({ where: { movieId: id } });
      if (input.genreIds.length > 0) {
        await tx.movieGenre.createMany({
          data: input.genreIds.map((genreId) => ({ movieId: id, genreId })),
        });
      }
      if (input.actorIds.length > 0) {
        await tx.movieActor.createMany({
          data: input.actorIds.map((actorId) => ({ movieId: id, actorId })),
        });
      }
      if (input.directorIds.length > 0) {
        await tx.movieDirector.createMany({
          data: input.directorIds.map((directorId) => ({ movieId: id, directorId })),
        });
      }
      if (input.producerIds.length > 0) {
        await tx.movieProducer.createMany({
          data: input.producerIds.map((producerId) => ({ movieId: id, producerId })),
        });
      }
    });
    if (current.posterUrl !== input.posterUrl) {
      await deleteStoredPhoto(current.posterUrl);
    }
    const full = await prisma.movie.findUniqueOrThrow({ where: { id }, include: movieInclude });
    return { ok: true as const, movie: toMovie(full) };
  } catch (error) {
    if (isUniqueError(error)) return { ok: false as const, status: 409, error: copy.admin.duplicate };
    if (isForeignKeyError(error)) return { ok: false as const, status: 400, error: copy.validation };
    throw error;
  }
}

export async function deleteMovie(id: string) {
  const current = await prisma.movie.findUnique({ where: { id } });
  if (!current) return { ok: false as const, status: 404, error: copy.notFound };
  await prisma.movie.delete({ where: { id } });
  await deleteStoredPhoto(current.posterUrl);
  return { ok: true as const };
}

export async function listGenres() {
  return prisma.genre.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
}

export async function getGenre(id: string) {
  const genre = await prisma.genre.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!genre) return { ok: false as const, status: 404, error: copy.notFound }
  return { ok: true as const, genre }
}

export async function createGenre(name: string) {
  try {
    const genre = await prisma.genre.create({
      data: { name, nameKey: nameKey(name) },
      select: { id: true, name: true },
    });
    return { ok: true as const, genre };
  } catch (error) {
    if (isUniqueError(error)) return { ok: false as const, status: 409, error: copy.admin.duplicate };
    throw error;
  }
}

export async function updateGenre(id: string, name: string) {
  try {
    const genre = await prisma.genre.update({
      where: { id },
      data: { name, nameKey: nameKey(name) },
      select: { id: true, name: true },
    });
    return { ok: true as const, genre };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false as const, status: 404, error: copy.notFound };
    }
    if (isUniqueError(error)) return { ok: false as const, status: 409, error: copy.admin.duplicate };
    throw error;
  }
}

export async function deleteGenre(id: string) {
  const links = await prisma.movieGenre.count({ where: { genreId: id } });
  if (links > 0) return { ok: false as const, status: 409, error: copy.admin.usedElsewhere };
  try {
    await prisma.genre.delete({ where: { id } });
    return { ok: true as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false as const, status: 404, error: copy.notFound };
    }
    throw error;
  }
}

const personSelect = { id: true, name: true, photoUrl: true, photoBlurhash: true } as const

async function listPeople(kind: PersonKind): Promise<PersonRecord[]> {
  if (kind === "actors") {
    return prisma.actor.findMany({ orderBy: { name: "asc" }, select: personSelect })
  }
  if (kind === "directors") {
    return prisma.director.findMany({ orderBy: { name: "asc" }, select: personSelect })
  }
  return prisma.producer.findMany({ orderBy: { name: "asc" }, select: personSelect })
}

export async function listPeoplePage(kind: PersonKind, options?: { page?: number; pageSize?: number }) {
  const pageSize = Math.min(Math.max(options?.pageSize ?? 50, 1), 100)
  const page = Math.max(options?.page ?? 1, 1)
  const skip = (page - 1) * pageSize

  const [total, people] =
    kind === "actors"
      ? await Promise.all([
          prisma.actor.count(),
          prisma.actor.findMany({ orderBy: { name: "asc" }, skip, take: pageSize, select: personSelect }),
        ])
      : kind === "directors"
        ? await Promise.all([
            prisma.director.count(),
            prisma.director.findMany({ orderBy: { name: "asc" }, skip, take: pageSize, select: personSelect }),
          ])
        : await Promise.all([
            prisma.producer.count(),
            prisma.producer.findMany({ orderBy: { name: "asc" }, skip, take: pageSize, select: personSelect }),
          ])

  return {
    people,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getPerson(kind: PersonKind, id: string) {
  const person =
    kind === "actors"
      ? await prisma.actor.findUnique({ where: { id }, select: personSelect })
      : kind === "directors"
        ? await prisma.director.findUnique({ where: { id }, select: personSelect })
        : await prisma.producer.findUnique({ where: { id }, select: personSelect })
  if (!person) return { ok: false as const, status: 404, error: copy.notFound }
  return { ok: true as const, person }
}

export { listPeople }

export async function createPerson(
  kind: PersonKind,
  name: string,
  photoUrl?: string | null,
  photoBlurhash?: string | null,
  id?: string,
) {
  const data = {
    ...(id ? { id } : {}),
    name,
    nameKey: nameKey(name),
    photoUrl: photoUrl ?? null,
    photoBlurhash: photoBlurhash ?? null,
  }
  try {
    const person =
      kind === "actors"
        ? await prisma.actor.create({
            data,
            select: { id: true, name: true, photoUrl: true, photoBlurhash: true },
          })
        : kind === "directors"
          ? await prisma.director.create({
              data,
              select: { id: true, name: true, photoUrl: true, photoBlurhash: true },
            })
          : await prisma.producer.create({
              data,
              select: { id: true, name: true, photoUrl: true, photoBlurhash: true },
            })
    return { ok: true as const, person }
  } catch (error) {
    if (isUniqueError(error)) return { ok: false as const, status: 409, error: copy.admin.duplicate }
    throw error
  }
}

export async function updatePerson(
  kind: PersonKind,
  id: string,
  name: string,
  photoUrl?: string | null,
  photoBlurhash?: string | null,
) {
  const data = {
    name,
    nameKey: nameKey(name),
    photoUrl: photoUrl ?? null,
    photoBlurhash: photoBlurhash ?? null,
  };
  try {
    const current =
      kind === "actors"
        ? await prisma.actor.findUnique({ where: { id }, select: { photoUrl: true } })
        : kind === "directors"
          ? await prisma.director.findUnique({ where: { id }, select: { photoUrl: true } })
          : await prisma.producer.findUnique({ where: { id }, select: { photoUrl: true } });
    if (!current) return { ok: false as const, status: 404, error: copy.notFound };

    const person =
      kind === "actors"
        ? await prisma.actor.update({
            where: { id },
            data,
            select: { id: true, name: true, photoUrl: true, photoBlurhash: true },
          })
        : kind === "directors"
          ? await prisma.director.update({
              where: { id },
              data,
              select: { id: true, name: true, photoUrl: true, photoBlurhash: true },
            })
          : await prisma.producer.update({
              where: { id },
              data,
              select: { id: true, name: true, photoUrl: true, photoBlurhash: true },
            });
    if (current.photoUrl !== person.photoUrl) await deleteStoredPhoto(current.photoUrl);
    return { ok: true as const, person };
  } catch (error) {
    if (isUniqueError(error)) return { ok: false as const, status: 409, error: copy.admin.duplicate };
    throw error;
  }
}

export async function deletePerson(kind: PersonKind, id: string) {
  const links =
    kind === "actors"
      ? await prisma.movieActor.count({ where: { actorId: id } })
      : kind === "directors"
        ? await prisma.movieDirector.count({ where: { directorId: id } })
        : await prisma.movieProducer.count({ where: { producerId: id } });
  if (links > 0) return { ok: false as const, status: 409, error: copy.admin.usedElsewhere };

  const current =
    kind === "actors"
      ? await prisma.actor.findUnique({ where: { id }, select: { photoUrl: true } })
      : kind === "directors"
        ? await prisma.director.findUnique({ where: { id }, select: { photoUrl: true } })
        : await prisma.producer.findUnique({ where: { id }, select: { photoUrl: true } });
  if (!current) return { ok: false as const, status: 404, error: copy.notFound };

  if (kind === "actors") await prisma.actor.delete({ where: { id } });
  else if (kind === "directors") await prisma.director.delete({ where: { id } });
  else await prisma.producer.delete({ where: { id } });

  await deleteStoredPhoto(current.photoUrl);
  return { ok: true as const };
}
