import Link from "next/link";
import type { ReactNode } from "react";
import { copy } from "@/lib/constants";

export const fieldClass =
  "h-11 w-full rounded-2xl border-0 bg-[var(--tg-theme-bg-color)] px-3 text-sm outline-none";

export const buttonClass =
  "inline-flex h-11 items-center justify-center rounded-full bg-[var(--tg-theme-button-color)] px-5 text-sm font-semibold text-[var(--tg-theme-button-text-color)] disabled:opacity-40";

export function AdminFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-5">
      <Link href="/admin" className="text-sm text-[var(--tg-theme-hint-color)]">
        {copy.admin.title}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </main>
  );
}
