"use client";

import Image from "next/image";
import { useState } from "react";
import { Blurhash } from "react-blurhash";

export function BlurImage({
  src,
  alt,
  blurhash,
  sizes,
  className,
}: {
  src: string;
  alt: string;
  blurhash: string;
  sizes: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className ?? ""}`}>
      {blurhash ? (
        <Blurhash
          hash={blurhash}
          width="100%"
          height="100%"
          resolutionX={32}
          resolutionY={56}
          punch={1}
          className="absolute inset-0 h-full w-full"
        />
      ) : null}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={`object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
