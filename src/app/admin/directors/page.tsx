"use client";

import { PersonManager } from "@/components/admin/person-manager";
import { copy } from "@/lib/constants";

export default function DirectorsPage() {
  return <PersonManager kind="directors" title={copy.admin.directors} />;
}
