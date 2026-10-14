export function PlayoffCounts({
  in16,
  in8,
  in4,
  in2,
  victory,
}: {
  in16: number
  in8: number
  in4: number
  in2: number
  victory: number
}) {
  return (
    <p className="mt-1 text-xs font-medium tabular-nums text-(--tg-theme-hint-color)" title="Плей-офф: 16 / 8 / 4 / 2 / победа">
      <span title="Топ-16">{in16}</span>
      <span> / </span>
      <span title="Топ-8">{in8}</span>
      <span> / </span>
      <span title="Топ-4">{in4}</span>
      <span> / </span>
      <span title="Финал">{in2}</span>
      <span> / </span>
      <span className="text-(--tg-theme-text-color)" title="Победа">
        {victory}
      </span>
    </p>
  )
}
