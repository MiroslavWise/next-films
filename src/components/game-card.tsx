import Link from "next/link";
import { copy } from "@/lib/constants";
import type { Game } from "@/lib/games";

export function GameCard({ game }: { game: Game }) {
  return (
    <article className="rounded-3xl bg-[var(--tg-theme-secondary-bg-color)] p-5">
      <h2 className="text-xl font-semibold tracking-tight">{game.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--tg-theme-hint-color)]">{game.description}</p>
      {game.status === "active" && game.href ? (
        <Link
          href={game.href}
          className="mt-4 inline-flex h-11 items-center rounded-full bg-[var(--tg-theme-button-color)] px-5 text-sm font-semibold text-[var(--tg-theme-button-text-color)]"
        >
          {copy.play}
        </Link>
      ) : (
        <p className="mt-4 text-sm font-semibold text-[var(--tg-theme-hint-color)]">{copy.soon}</p>
      )}
    </article>
  );
}
