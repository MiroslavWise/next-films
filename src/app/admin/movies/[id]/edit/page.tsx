"use client"

import { use } from "react"
import { MovieForm } from "@/components/admin/movie-form"

export default function EditMoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <MovieForm mode="edit" movieId={id} />
}
