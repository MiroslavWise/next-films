import type { ComponentType, ReactNode, SVGProps } from "react"
import type { GameSlug } from "@/lib/games"

type IconProps = SVGProps<SVGSVGElement>

function IconShell({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

/** Три постера и выбор — «Кино-выбор». */
export function MovieChoiceIcon(props: IconProps) {
  return (
    <IconShell {...props}>
      <rect x="5" y="14" width="11" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="18.5" y="10" width="11" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="32" y="14" width="11" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M24 34v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M19 39.5h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconShell>
  )
}

/** Турнирная сетка — «Кино-плей-офф». */
export function MoviePlayoffIcon(props: IconProps) {
  return (
    <IconShell {...props}>
      <rect x="6" y="8" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="32" y="8" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="6" y="33" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="32" y="33" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16 11.5h5.5V24H26.5V11.5H32M16 36.5h5.5V24H26.5V36.5H32"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="3" fill="currentColor" />
    </IconShell>
  )
}

/** Кадр плёнки с вопросом — «Угадай кадр». */
export function FrameGuessIcon(props: IconProps) {
  return (
    <IconShell {...props}>
      <rect x="8" y="10" width="32" height="28" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M8 16h32M8 32h32" stroke="currentColor" strokeWidth="2" />
      <rect x="11" y="12" width="3" height="2.5" rx="0.5" fill="currentColor" />
      <rect x="17" y="12" width="3" height="2.5" rx="0.5" fill="currentColor" />
      <rect x="28" y="12" width="3" height="2.5" rx="0.5" fill="currentColor" />
      <rect x="34" y="12" width="3" height="2.5" rx="0.5" fill="currentColor" />
      <rect x="11" y="33.5" width="3" height="2.5" rx="0.5" fill="currentColor" />
      <rect x="17" y="33.5" width="3" height="2.5" rx="0.5" fill="currentColor" />
      <rect x="28" y="33.5" width="3" height="2.5" rx="0.5" fill="currentColor" />
      <rect x="34" y="33.5" width="3" height="2.5" rx="0.5" fill="currentColor" />
      <path
        d="M21.5 21.5c0-1.5 1.2-2.5 2.5-2.5s2.5 1 2.5 2.5c0 1.2-1 1.8-2 2.3-.7.35-1 .7-1 1.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="29" r="1.25" fill="currentColor" />
    </IconShell>
  )
}

/** Сетка поверх кадра — «Прояви кадр». */
export function FrameRevealIcon(props: IconProps) {
  return (
    <IconShell {...props}>
      <rect x="6" y="12" width="36" height="24" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M15 12v24M24 12v24M33 12v24M6 20h36M6 28h36" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      <rect x="15" y="20" width="9" height="8" fill="currentColor" opacity="0.35" />
      <rect x="24" y="12" width="9" height="8" fill="currentColor" opacity="0.2" />
    </IconShell>
  )
}

/** Кавычки реплики — «Киноцитаты». */
export function QuotesIcon(props: IconProps) {
  return (
    <IconShell {...props}>
      <path
        d="M12 18c0-3.3 2.2-6 5.5-6v4.2c-1.4 0-2.3.9-2.3 2.2V22H20v10h-8V18Zm16 0c0-3.3 2.2-6 5.5-6v4.2c-1.4 0-2.3.9-2.3 2.2V22H36v10h-8V18Z"
        fill="currentColor"
      />
      <path d="M10 36h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
    </IconShell>
  )
}

const gameIcons: Record<GameSlug, ComponentType<IconProps>> = {
  "movie-choice": MovieChoiceIcon,
  "movie-playoff": MoviePlayoffIcon,
  "frame-guess": FrameGuessIcon,
  "frame-reveal": FrameRevealIcon,
  quotes: QuotesIcon,
}

export function GameIcon({ slug, className }: { slug: GameSlug; className?: string }) {
  const Icon = gameIcons[slug]
  return <Icon className={className} />
}
