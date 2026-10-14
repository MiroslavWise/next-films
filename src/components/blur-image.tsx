"use client"

import Image from "next/image"
import { useState } from "react"
import { Blurhash } from "react-blurhash"
import { BLURHASH_PREVIEW_LANDSCAPE, BLURHASH_PREVIEW_PORTRAIT } from "@/lib/constants"
import { mediaSrc } from "@/lib/media"

export type BlurImageOrientation = "portrait" | "landscape"

export function BlurImage({
  src,
  alt,
  blurhash,
  sizes,
  className,
  orientation = "portrait",
  objectFit = "cover",
}: {
  src: string
  alt: string
  blurhash: string
  sizes: string
  className?: string
  /** Постеры — portrait; кадры «Угадай кадр» — landscape. */
  orientation?: BlurImageOrientation
  objectFit?: "cover" | "contain"
}) {
  const [loaded, setLoaded] = useState(false)
  const imageSrc = mediaSrc(src)
  const preview = orientation === "landscape" ? BLURHASH_PREVIEW_LANDSCAPE : BLURHASH_PREVIEW_PORTRAIT

  return (
    <div className={`absolute inset-0 overflow-hidden ${className ?? ""}`}>
      {blurhash ? (
        <Blurhash
          hash={blurhash}
          width="100%"
          height="100%"
          resolutionX={preview.x}
          resolutionY={preview.y}
          punch={1}
          className="absolute inset-0 h-full w-full"
        />
      ) : null}
      <Image
        src={imageSrc}
        alt={alt}
        fill
        sizes={sizes}
        unoptimized={imageSrc.startsWith("/api/media/")}
        className={`${objectFit === "contain" ? "object-contain" : "object-cover"} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
