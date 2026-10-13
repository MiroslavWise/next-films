import { Suspense } from "react"
import { MovieFormSkeleton } from "@/components/admin/admin-skeletons"
import { PersonForm } from "@/components/admin/person-form"
import { copy } from "@/lib/constants"

export function generateStaticParams() {
  return [{ id: "00000000-0000-7000-8000-000000000000" }]
}

export default function EditActorPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-5">
          <MovieFormSkeleton />
        </main>
      }
    >
      <EditActorContent params={params} />
    </Suspense>
  )
}

async function EditActorContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <PersonForm
      kind="actors"
      mode="edit"
      personId={id}
      title={copy.admin.actorEdit}
      backHref="/admin/actors"
      backLabel={copy.admin.actors}
    />
  )
}
