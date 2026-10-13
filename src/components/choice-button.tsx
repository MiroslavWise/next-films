export function ChoiceButton({
  label,
  ariaLabel,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-1.5 py-2 text-center text-[11px] font-medium leading-tight disabled:opacity-60 ${
        selected
          ? "bg-(--tg-theme-button-color) text-(--tg-theme-button-text-color)"
          : "bg-[var(--tg-theme-bg-color)] text-(--tg-theme-text-color)"
      }`}
    >
      {label}
    </button>
  );
}
