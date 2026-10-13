"use client";

import { PersonManager } from "@/components/admin/person-manager";
import { copy } from "@/lib/constants";

export default function ActorsPage() {
  return <PersonManager kind="actors" title={copy.admin.actors} />;
}
