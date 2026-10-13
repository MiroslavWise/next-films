/** Shape lock: panels 14px, controls 10px (no mixed pills). */
export const panelClass = "rounded-[var(--radius-md)] border border-(--surface-border) bg-(--tg-theme-secondary-bg-color) p-4"

export const fieldClass =
  "h-11 w-full rounded-[var(--radius-sm)] border border-(--surface-border-strong) bg-(--tg-theme-bg-color) px-3 text-sm text-(--tg-theme-text-color) outline-none transition-[border-color,box-shadow] focus:border-(--tg-theme-button-color) focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--tg-theme-button-color)_28%,transparent)]"

export const buttonClass =
  "inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] bg-(--tg-theme-button-color) px-5 text-sm font-semibold text-(--tg-theme-button-text-color) transition-transform active:scale-[0.98] disabled:opacity-40"

export const ghostButtonClass =
  "inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] border border-(--surface-border-strong) bg-transparent px-4 text-sm font-medium text-(--tg-theme-text-color) transition-transform active:scale-[0.98]"

export const linkActionClass = "text-sm font-medium text-(--tg-theme-link-color) underline-offset-2 hover:underline"

export const dangerActionClass = "text-sm font-medium text-(--danger) underline-offset-2 hover:underline"
