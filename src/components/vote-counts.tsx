export function VoteCounts({
  many,
  once,
  remove,
}: {
  many: number
  once: number
  remove: number
}) {
  return (
    <p className="mt-1 text-xs font-medium tabular-nums">
      <span className="text-(--choice-many)" title="Много">
        {many}
      </span>
      <span className="text-(--tg-theme-hint-color)"> / </span>
      <span className="text-(--choice-once)" title="Один">
        {once}
      </span>
      <span className="text-(--tg-theme-hint-color)"> / </span>
      <span className="text-(--choice-remove)" title="Убрать">
        {remove}
      </span>
    </p>
  )
}
