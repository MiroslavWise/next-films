import { ChoiceButton } from "@/components/choice-button"
import { BlurImage } from "@/components/blur-image"
import { copy } from "@/lib/constants"
import type { RoundMovie, VoteChoiceName } from "@/types/api"

const choiceOptions: VoteChoiceName[] = ["WATCH_MANY", "WATCH_ONCE", "REMOVE"]

export function MovieCard({
  movie,
  choice,
  takenChoices,
  disabled,
  onChoice,
}: {
  movie: RoundMovie
  choice?: VoteChoiceName
  takenChoices?: VoteChoiceName[]
  disabled?: boolean
  onChoice: (choice: VoteChoiceName) => void
}) {
  const taken = new Set(takenChoices ?? [])

  return (
    <article
      className="flex min-w-0 flex-col overflow-hidden rounded-md border border-(--surface-border) bg-(--tg-theme-secondary-bg-color)"
      aria-label={movie.title}
    >
      <div className="relative aspect-9/16">
        <BlurImage src={movie.posterUrl} alt={movie.title} blurhash={movie.posterBlurhash} sizes="33vw" />
      </div>
      <span className="sr-only">{movie.title}</span>
      <div className="grid gap-1 p-1.5">
        {choiceOptions.map((item) => {
          const selected = choice === item
          const occupied = !selected && taken.has(item)
          return (
            <ChoiceButton
              key={item}
              label={copy.choicesShort[item]}
              ariaLabel={copy.choices[item]}
              choice={item}
              selected={selected}
              disabled={disabled || occupied}
              onClick={() => onChoice(item)}
            />
          )
        })}
      </div>
    </article>
  )
}
