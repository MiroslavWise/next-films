import { Suspense } from "react"
import { MovieFormSkeleton } from "@/components/admin/admin-skeletons"
import { FrameGuessForm } from "@/components/admin/frame-guess-form"

/** Нужен хотя бы один sample-param, чтобы Cache Components смог собрать App Shell. */
export function generateStaticParams() {
  return [{ id: "00000000-0000-7000-8000-000000000000" }]
}

export default function MovieFramesPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-5">
          <MovieFormSkeleton />
        </main>
      }
    >
      <MovieFramesContent params={params} />
    </Suspense>
  )
}

async function MovieFramesContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FrameGuessForm movieId={id} />
}
