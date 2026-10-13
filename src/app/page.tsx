import { GameCard } from "@/components/game-card";
import { copy } from "@/lib/constants";
import { games } from "@/lib/games";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6">
      <div>
        <p className="text-sm text-(--tg-theme-hint-color)">{copy.appTitle}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{copy.homeLead}</h1>
      </div>
      <div className="grid gap-3">
        {games.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
    </main>
  );
}
