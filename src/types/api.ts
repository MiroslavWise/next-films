export const enum VoteChoiceName {
  WATCH_MANY = "WATCH_MANY",
  WATCH_ONCE = "WATCH_ONCE",
  REMOVE = "REMOVE",
}

export type RoundMovie = {
  id: string
  title: string
  posterUrl: string
  posterBlurhash: string
}

export type RoundResponse = {
  movies: RoundMovie[]
  finished: boolean
}

export type VoteResponse = {
  ok: true
  processed: number
  skipped: number
  next: RoundResponse
}

export type PlayoffMovieRef = {
  id: string
  title: string
  posterUrl: string
  posterBlurhash: string
}

export type PlayoffMatchView = {
  id: string
  roundIndex: number
  slot: number
  leftMovieId: string | null
  rightMovieId: string | null
  winnerMovieId: string | null
  left: PlayoffMovieRef | null
  right: PlayoffMovieRef | null
}

export type PlayoffBracket = {
  size: 32
  seedMovieIds: string[]
  movies: PlayoffMovieRef[]
  matches: Array<{
    id: string
    roundIndex: number
    slot: number
    leftMovieId: string | null
    rightMovieId: string | null
    winnerMovieId: string | null
  }>
}

export type PlayoffTournamentResponse = {
  id: string
  status: "GAME" | "PRE_END" | "END"
  roundIndex: number
  version: number
  finalistMovieId: string | null
  bracket: PlayoffBracket
  currentMatch: PlayoffMatchView | null
  finalist: PlayoffMovieRef | null
  createdAt: string
  updatedAt: string
}

export type PlayoffCurrentResponse = {
  tournament: PlayoffTournamentResponse
  resumed?: boolean
}

export type PlayoffHistoryItem = {
  id: string
  createdAt: string
  finalist: PlayoffMovieRef | null
}

export type PlayoffHistoryResponse = {
  tournaments: PlayoffHistoryItem[]
}

export type PlayoffInsufficientResponse = {
  insufficient: true
  available: number
}

export type PlayoffFinishResponse = {
  ok: true
  action: "home" | "restart"
  tournament: PlayoffTournamentResponse | null
}

export type SessionUser = {
  id: string
  username?: string
  firstName?: string
  lastName?: string
  isAdmin: boolean
}

export type SessionResponse = {
  token: string
  expiresAt: string
  user: SessionUser
}

export type VisitorProfile = {
  id: string
  username: string | null
  firstName: string | null
  lastVisit: string
}

export type ListUsersResponse = {
  users: VisitorProfile[]
}

export type ApiError = {
  error: string
}

export type NamedRef = {
  id: string
  name: string
}

export type PersonRecord = NamedRef & {
  photoUrl: string | null
  photoBlurhash: string | null
}

export type MovieRecord = {
  id: string
  title: string
  posterUrl: string
  posterBlurhash: string
  watchManyCount: number
  onceEnoughCount: number
  removeFromIndustryCount: number
  playoffIn16Count: number
  playoffIn8Count: number
  playoffIn4Count: number
  playoffIn2Count: number
  playoffVictoryCount: number
  genres: NamedRef[]
  actors: PersonRecord[]
  directors: PersonRecord[]
  producers: PersonRecord[]
}

export type FrameGuessFrame = {
  id: string
  url: string
  blurhash: string
}

export type FrameGuessEntryRecord = {
  id: string | null
  movieId: string
  movieTitle: string
  frames: FrameGuessFrame[]
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type FrameGuessOption = {
  movieId: string
  title: string
}

export type FrameGuessRoundPublic = {
  id: string
  imageUrl: string
  imageBlurhash: string
  options: FrameGuessOption[]
}

export type FrameGuessRoundAnswered = FrameGuessRoundPublic & {
  chosenMovieId: string
  isCorrect: boolean
  correctMovieId: string
  correctTitle: string
  answeredAt: string
}

export type FrameGuessSessionResponse = {
  id: string
  status: "ACTIVE" | "ENDED"
  correctCount: number
  answeredCount: number
  createdAt: string
  updatedAt: string
  endedAt: string | null
  currentRound: FrameGuessRoundPublic | null
}

export type FrameGuessCurrentResponse = {
  session: FrameGuessSessionResponse
  resumed?: boolean
}

export type FrameGuessHistoryItem = {
  id: string
  createdAt: string
  endedAt: string | null
  correctCount: number
  answeredCount: number
  preview: { imageUrl: string; imageBlurhash: string } | null
}

export type FrameGuessHistoryResponse = {
  sessions: FrameGuessHistoryItem[]
}

export type FrameGuessSessionDetailResponse = {
  session: FrameGuessSessionResponse & {
    rounds: FrameGuessRoundAnswered[]
  }
}

export type FrameGuessAnswerResponse = {
  session: FrameGuessSessionResponse
  answered: FrameGuessRoundAnswered
  nextRound: FrameGuessRoundPublic | null
  insufficientNext?: boolean
}

export type FrameGuessFinishResponse = {
  ok: true
  action: "home" | "restart"
  session: FrameGuessSessionResponse | null
}

export type FrameGuessInsufficientResponse = {
  insufficient: true
  entries: number
  movies: number
}
