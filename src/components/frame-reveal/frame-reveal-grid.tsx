"use client"

import { useMemo } from "react"
import { BlurImage } from "@/components/blur-image"

type Props = {
  imageUrl: string
  imageBlurhash: string
  cols: number
  rows: number
  openedCells: number[]
  alt: string
  /** В истории можно чуть сильнее подсветить закрытые клетки */
  dimClosed?: boolean
}

export function FrameRevealGrid({
  imageUrl,
  imageBlurhash,
  cols,
  rows,
  openedCells,
  alt,
  dimClosed = false,
}: Props) {
  const opened = useMemo(() => new Set(openedCells), [openedCells])
  const cells = cols * rows

  return (
    <div className="relative aspect-video overflow-hidden rounded-sm border border-(--surface-border) bg-(--tg-theme-bg-color)">
      <BlurImage
        src={imageUrl}
        alt={alt}
        blurhash={imageBlurhash}
        sizes="100vw"
        orientation="landscape"
        objectFit="cover"
      />
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
        aria-hidden="true"
      >
        {Array.from({ length: cells }, (_, index) => {
          const isOpen = opened.has(index)
          return (
            <div
              key={index}
              className={
                isOpen
                  ? "bg-transparent"
                  : dimClosed
                    ? "bg-[color-mix(in_srgb,var(--tg-theme-bg-color)_82%,transparent)] backdrop-blur-[14px]"
                    : "bg-[color-mix(in_srgb,var(--tg-theme-bg-color)_78%,transparent)] backdrop-blur-[12px]"
              }
            />
          )
        })}
      </div>
    </div>
  )
}
