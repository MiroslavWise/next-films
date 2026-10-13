import { Suspense } from "react"
import { MovieFormSkeleton } from "@/components/admin/admin-skeletons"
import { GenreForm } from "@/components/admin/genre-form"

export function generateStaticParams() {
  return [{ id: "00000000-0000-7000-8000-000000000000" }]
}

export default function EditGenrePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-5">
          <MovieFormSkeleton />
        </main>
      }
    >
      <EditGenreContent params={params} />
    </Suspense>
  )
}

async function EditGenreContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GenreForm mode="edit" genreId={id} />
}
