"use client"

import { copy } from "@/lib/constants"

type Props = {
  label: string
  hint?: string
  fileName?: string | null
  accept?: string
  onChange: (file: File | null) => void
}

export function FileUploadField({
  label,
  hint,
  fileName,
  accept = "image/jpeg,image/png,image/webp,image/avif,image/gif",
  onChange,
}: Props) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {hint ? <span className="text-xs text-[var(--tg-theme-hint-color)]">{hint}</span> : null}
      <span className="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--tg-theme-hint-color)_55%,transparent)] bg-[var(--tg-theme-bg-color)] px-3 py-3 text-center text-sm text-[var(--tg-theme-hint-color)]">
        {fileName ? (
          <span className="truncate text-[var(--tg-theme-text-color)]">{fileName}</span>
        ) : (
          <span>{copy.admin.chooseFile}</span>
        )}
        <input
          className="sr-only"
          type="file"
          accept={accept}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </span>
    </label>
  )
}
