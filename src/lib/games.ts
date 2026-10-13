export type GameStatus = "active" | "soon"

export type Game = {
  slug: string
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
    status: "active",
  },
  {
    slug: "movie-playoff",
    title: "Кино-плей-офф",
    description: "16 случайных постеров в сетке: каждый раунд выбираете лучший из двух, пока не останется один финалист.",
    status: "soon",
  },
  {
    slug: "frame-guess",
    title: "Угадай кадр",
    description: "Один кадр — и нужно назвать фильм.",
    status: "soon",
  },
  {
    slug: "quotes",
    title: "Киноцитаты",
    description: "Узнайте фильм по короткой реплике.",
    status: "soon",
  },
]
