import { Suspense } from "react"
import { MovieForm } from "@/components/admin/movie-form"
import { copy } from "@/lib/constants"

/** Нужен хотя бы один sample-param, чтобы Cache Components смог собрать App Shell. */
export function generateStaticParams() {
  return [{ id: "00000000-0000-7000-8000-000000000000" }]
}

export default function EditMoviePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-5 text-sm text-(--tg-theme-hint-color)">{copy.loading}</p>}>
      <EditMovieContent params={params} />
    </Suspense>
  )
}

async function EditMovieContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MovieForm mode="edit" movieId={id} />
}
