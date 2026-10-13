import Link from "next/link";
import { copy } from "@/lib/constants";

export function EmptyState() {
  return (
    <div className="rounded-3xl bg-[var(--tg-theme-secondary-bg-color)] p-6 text-center">
      <h2 className="text-xl font-semibold">{copy.emptyTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--tg-theme-hint-color)]">{copy.emptyText}</p>
      <Link
        href="/"
        className="mt-4 inline-flex h-11 items-center rounded-full bg-[var(--tg-theme-button-color)] px-5 text-sm font-semibold text-[var(--tg-theme-button-text-color)]"
      >
        {copy.backHome}
      </Link>
    </div>
  );
}
