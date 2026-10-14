export const enum GameStatus {
  Active = "active",
  Soon = "soon",
}

export type GameSlug = "movie-choice" | "movie-playoff" | "frame-guess" | "quotes"

export type Game = {
  slug: GameSlug
  title: string
  description: string
  href?: string
  status: GameStatus
}

export const games: Game[] = [
  {
    slug: "movie-choice",
    title: "Кино-выбор",
    description: "Три фильма и три решения: пересматривать, одного раза достаточно или убрать из киноиндустрии.",
    href: "/games/movie-choice",
    status: GameStatus.Active,
  },
  {
    slug: "movie-playoff",
    title: "Кино-плей-офф",
    description: "32 случайных постера в сетке: каждый раунд выбираете лучший из двух, пока не останется один финалист.",
    href: "/games/movie-playoff",
    status: GameStatus.Active,
  },
  {
    slug: "frame-guess",
    title: "Угадай кадр",
    description: "Один кадр — и нужно назвать фильм.",
    status: GameStatus.Soon,
  },
  {
    slug: "quotes",
    title: "Киноцитаты",
    description: "Узнайте фильм по короткой реплике.",
    status: GameStatus.Soon,
  },
]
