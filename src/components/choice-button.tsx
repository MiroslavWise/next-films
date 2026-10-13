import { choiceIdleClass, choiceSelectedClass } from "@/lib/choice-colors"
import type { VoteChoiceName } from "@/types/api"

export function ChoiceButton({
  label,
  ariaLabel,
  choice,
  selected,
  disabled,
  onClick,
}: {
  label: string
  ariaLabel?: string
  choice: VoteChoiceName
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-[var(--radius-sm)] border px-1.5 py-2 text-center text-[11px] font-medium leading-tight transition-transform active:scale-[0.98] disabled:opacity-45 ${
        selected ? choiceSelectedClass(choice) : choiceIdleClass(choice)
      }`}
    >
      {label}
    </button>
  )
}
