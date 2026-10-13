import { z } from "zod";

const uuid = z.string().uuid();

export const voteBodySchema = z
  .object({
    votes: z
      .array(
        z.object({
          movieId: uuid,
          choice: z.enum(["WATCH_MANY", "WATCH_ONCE", "REMOVE"]),
        }),
      )
      .min(1)
      .max(3),
  })
  .refine((body) => new Set(body.votes.map((vote) => vote.movieId)).size === body.votes.length, {
    message: "Фильмы в одном запросе не должны повторяться",
  });

const idList = z.array(uuid).default([]);

export const movieBodySchema = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(1).max(200),
  posterUrl: z.url(),
  posterBlurhash: z.string().min(6).max(200),
  genreIds: idList,
  actorIds: idList,
  directorIds: idList,
  producerIds: idList,
})

export const personBodySchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(200),
  photoUrl: z.url().nullable().optional(),
  photoBlurhash: z.string().min(6).max(200).nullable().optional(),
})

export const genreBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const personKindSchema = z.enum(["actors", "directors", "producers"]);

export type PersonKind = z.infer<typeof personKindSchema>;
