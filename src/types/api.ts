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
  watchManyCount: number;
  onceEnoughCount: number;
  removeFromIndustryCount: number;
  genres: NamedRef[];
  actors: PersonRecord[];
  directors: PersonRecord[];
  producers: PersonRecord[];
};
