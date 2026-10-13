"use client"

import { copy } from "@/lib/constants"

type Props = {
  label: string
  hint?: string
  fileName?: string | null
  accept?: string
  resetKey?: string | number
  onChange: (file: File | null) => void
}

export function FileUploadField({
  label,
  hint,
  fileName,
  accept = "image/jpeg,image/png,image/webp,image/avif,image/gif",
  resetKey = 0,
  onChange,
}: Props) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {hint ? <span className="text-xs text-(--tg-theme-hint-color)">{hint}</span> : null}
      <span
        className={`flex min-h-16 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-dashed px-3 py-3 text-center text-sm transition-colors ${
          fileName
            ? "border-(--tg-theme-button-color) bg-[color-mix(in_srgb,var(--tg-theme-button-color)_8%,transparent)] text-(--tg-theme-text-color)"
            : "border-(--surface-border-strong) bg-(--tg-theme-bg-color) text-(--tg-theme-hint-color) hover:border-(--tg-theme-button-color)"
        }`}
      >
        {fileName ? <span className="truncate font-medium">{fileName}</span> : <span>{copy.admin.chooseFile}</span>}
        <input
          key={resetKey}
          className="sr-only"
          type="file"
          accept={accept}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </span>
    </label>
  )
}
