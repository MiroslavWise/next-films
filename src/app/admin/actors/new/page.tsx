"use client"

import { PersonForm } from "@/components/admin/person-form"
import { copy } from "@/lib/constants"

export default function NewActorPage() {
  return (
    <PersonForm
      kind="actors"
      mode="create"
      title={copy.admin.actorAdd}
      backHref="/admin/actors"
      backLabel={copy.admin.actors}
    />
  )
}
