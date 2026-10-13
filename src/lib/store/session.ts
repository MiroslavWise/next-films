import { create } from "zustand"
import type { SessionUser, VoteChoiceName } from "@/types/api"

type SessionState = {
  ready: boolean
  sessionToken: string | null
  user: SessionUser | null
  initData: string
  isTelegram: boolean
  colorScheme: "light" | "dark"
  choices: Record<string, VoteChoiceName>
  setBoot: (payload: { ready: boolean; initData: string; isTelegram: boolean; colorScheme: "light" | "dark" }) => void
  setSession: (token: string, user: SessionUser) => void
  clearSession: () => void
  setChoice: (movieId: string, choice: VoteChoiceName) => void
  clearChoices: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  ready: false,
  sessionToken: null,
  user: null,
  initData: "",
  isTelegram: false,
  colorScheme: "light",
  choices: {},
  setBoot: (payload) => set(payload),
  setSession: (sessionToken, user) => set({ sessionToken, user }),
  clearSession: () => set({ sessionToken: null, user: null }),
  setChoice: (movieId, choice) => set((state) => ({ choices: { ...state.choices, [movieId]: choice } })),
  clearChoices: () => set({ choices: {} }),
}))
