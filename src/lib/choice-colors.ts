import type { VoteChoiceName } from "@/types/api"

export function choiceSelectedClass(choice: VoteChoiceName) {
  switch (choice) {
    case "WATCH_MANY":
      return "border-(--choice-many) bg-(--choice-many) text-white"
    case "WATCH_ONCE":
      return "border-(--choice-once) bg-(--choice-once) text-white"
    case "REMOVE":
      return "border-(--choice-remove) bg-(--choice-remove) text-white"
  }
}

export function choiceIdleClass(choice: VoteChoiceName) {
  switch (choice) {
    case "WATCH_MANY":
      return "border-(--choice-many) bg-[color-mix(in_srgb,var(--choice-many)_12%,var(--tg-theme-bg-color))] text-(--choice-many)"
    case "WATCH_ONCE":
      return "border-(--choice-once) bg-[color-mix(in_srgb,var(--choice-once)_12%,var(--tg-theme-bg-color))] text-(--choice-once)"
    case "REMOVE":
      return "border-(--choice-remove) bg-[color-mix(in_srgb,var(--choice-remove)_12%,var(--tg-theme-bg-color))] text-(--choice-remove)"
  }
}
