"use client"

import Link from "next/link"
import { GameCard } from "@/components/game-card"
import { buttonClass } from "@/lib/ui"
import { copy } from "@/lib/constants"
import { games } from "@/lib/games"
import { userFromSessionToken } from "@/lib/session-claims"
import { useSessionStore } from "@/lib/store/session"

export default function Home() {
  const sessionToken = useSessionStore((state) => state.sessionToken)
  const user = useSessionStore((state) => state.user)
  const claims = sessionToken ? userFromSessionToken(sessionToken, user) : user
  const isAdmin = claims?.isAdmin === true

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
      <header className="flex items-start justify-between gap-3 border-b border-(--surface-border) pb-4">
        <div>
          <p className="text-sm font-medium text-(--tg-theme-hint-color)">{copy.appTitle}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{copy.homeLead}</h1>
        </div>
        {isAdmin ? (
          <Link href="/admin" className={`${buttonClass} h-10 shrink-0 px-4`}>
            {copy.admin.open}
          </Link>
        ) : null}
      </header>
      <div className="grid gap-3">
        {games.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
    </main>
  )
}
