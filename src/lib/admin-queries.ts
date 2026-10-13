"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, uploadPhoto } from "@/lib/api-client"
import { ADMIN_MOVIES_PAGE_SIZE } from "@/lib/constants"
import { useTelegram } from "@/lib/telegram/use-telegram"
import type { PersonKind } from "@/lib/validators"
import type { MovieRecord, NamedRef, PersonRecord } from "@/types/api"

export type MoviesPage = {
  movies: MovieRecord[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export const adminKeys = {
  all: ["admin"] as const,
  genres: () => [...adminKeys.all, "genres"] as const,
  people: (kind: PersonKind) => [...adminKeys.all, "people", kind] as const,
  movies: () => [...adminKeys.all, "movies"] as const,
  moviesPage: (page: number) => [...adminKeys.movies(), "page", page] as const,
  movie: (id: string) => [...adminKeys.all, "movie", id] as const,
}

async function fetchGenres() {
  const data = await api<{ genres: NamedRef[] }>("/api/admin/genres")
  return data.genres
}

async function fetchPeople(kind: PersonKind) {
  const data = await api<{ people: PersonRecord[] }>(`/api/admin/people/${kind}`)
  return data.people
}

async function fetchMoviesPage(page: number) {
  return api<MoviesPage>(`/api/admin/movies?page=${page}&pageSize=${ADMIN_MOVIES_PAGE_SIZE}`)
}

async function fetchMovie(id: string) {
  const data = await api<{ movie: MovieRecord }>(`/api/admin/movies/${id}`)
  return data.movie
}

export function useGenresQuery() {
  const { ready } = useTelegram()
  return useQuery({
    queryKey: adminKeys.genres(),
    queryFn: fetchGenres,
    enabled: ready,
  })
}

export function usePeopleQuery(kind: PersonKind) {
  const { ready } = useTelegram()
  return useQuery({
    queryKey: adminKeys.people(kind),
    queryFn: () => fetchPeople(kind),
    enabled: ready,
  })
}

export function useCatalogRefsQuery() {
  const genres = useGenresQuery()
  const actors = usePeopleQuery("actors")
  const directors = usePeopleQuery("directors")
  const producers = usePeopleQuery("producers")

  return {
    genres: genres.data ?? [],
    actors: actors.data ?? [],
    directors: directors.data ?? [],
    producers: producers.data ?? [],
    isPending: genres.isPending || actors.isPending || directors.isPending || producers.isPending,
    isError: genres.isError || actors.isError || directors.isError || producers.isError,
    error: genres.error ?? actors.error ?? directors.error ?? producers.error,
  }
}

export function useMoviesPageQuery(page: number) {
  const { ready } = useTelegram()
  return useQuery({
    queryKey: adminKeys.moviesPage(page),
    queryFn: () => fetchMoviesPage(page),
    enabled: ready && page >= 1,
  })
}

export function useMovieQuery(id: string | undefined, enabled = true) {
  const { ready } = useTelegram()
  return useQuery({
    queryKey: adminKeys.movie(id ?? ""),
    queryFn: () => fetchMovie(id!),
    enabled: ready && enabled && Boolean(id),
  })
}

export function useInvalidateAdmin() {
  const queryClient = useQueryClient()
  return {
    genres: () => queryClient.invalidateQueries({ queryKey: adminKeys.genres() }),
    people: (kind: PersonKind) => queryClient.invalidateQueries({ queryKey: adminKeys.people(kind) }),
    movies: () => queryClient.invalidateQueries({ queryKey: adminKeys.movies() }),
    movie: (id: string) => queryClient.invalidateQueries({ queryKey: adminKeys.movie(id) }),
  }
}

export function useSaveMovieMutation() {
  const invalidate = useInvalidateAdmin()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      mode: "create" | "edit"
      movieId?: string
      title: string
      file: File | null
      existing?: Pick<MovieRecord, "id" | "posterUrl" | "posterBlurhash"> | null
      genreIds: string[]
      actorIds: string[]
      directorIds: string[]
      producerIds: string[]
      nextId: string
    }) => {
      let posterUrl = input.existing?.posterUrl ?? ""
      let posterBlurhash = input.existing?.posterBlurhash ?? ""
      if (input.file) {
        const uploaded = await uploadPhoto(input.file, "poster", input.nextId)
        posterUrl = uploaded.url
        posterBlurhash = uploaded.blurhash
      }
      const body = JSON.stringify({
        id: input.nextId,
        title: input.title,
        posterUrl,
        posterBlurhash,
        genreIds: input.genreIds,
        actorIds: input.actorIds,
        directorIds: input.directorIds,
        producerIds: input.producerIds,
      })
      if (input.mode === "edit" && input.movieId) {
        return api<{ movie: MovieRecord }>(`/api/admin/movies/${input.movieId}`, { method: "PATCH", body })
      }
      return api<{ movie: MovieRecord }>("/api/admin/movies", { method: "POST", body })
    },
    onSuccess: async (data, variables) => {
      await invalidate.movies()
      if (variables.mode === "edit" && variables.movieId) {
        queryClient.setQueryData(adminKeys.movie(variables.movieId), data.movie)
      }
    },
  })
}
