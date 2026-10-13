"use client";

import { PersonManager } from "@/components/admin/person-manager";
import { copy } from "@/lib/constants";

export default function ProducersPage() {
  return <PersonManager kind="producers" title={copy.admin.producers} />;
}
