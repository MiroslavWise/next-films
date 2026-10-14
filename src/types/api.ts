export type VoteChoiceName = "WATCH_MANY" | "WATCH_ONCE" | "REMOVE";

export type RoundMovie = {
  id: string;
  title: string;
  posterUrl: string;
  posterBlurhash: string;
};

export type RoundResponse = {
  movies: RoundMovie[];
  finished: boolean;
};

export type VoteResponse = {
  ok: true;
  processed: number;
  skipped: number;
  next: RoundResponse;
};

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
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  isAdmin: boolean;
};

export type SessionResponse = {
  token: string;
  expiresAt: string;
  user: SessionUser;
};

export type VisitorProfile = {
  id: number;
  username: string | null;
  firstName: string | null;
  lastVisit: string;
};

export type ListUsersResponse = {
  users: VisitorProfile[];
};

export type ApiError = {
  error: string;
};

export type NamedRef = {
  id: string;
  name: string;
};

export type PersonRecord = NamedRef & {
  photoUrl: string | null;
  photoBlurhash: string | null;
};

export type MovieRecord = {
  id: string;
  title: string;
  posterUrl: string;
  posterBlurhash: string;
  watchManyCount: number
  onceEnoughCount: number
  removeFromIndustryCount: number
  playoffIn16Count: number
  playoffIn8Count: number
  playoffIn4Count: number
  playoffIn2Count: number
  playoffVictoryCount: number
  genres: NamedRef[];
  actors: PersonRecord[];
  directors: PersonRecord[];
  producers: PersonRecord[];
};
