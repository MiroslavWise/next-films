import { copy } from "@/lib/constants";

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl bg-[var(--tg-theme-secondary-bg-color)] p-6 text-center">
      <p className="text-base leading-6">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-11 items-center rounded-full bg-[var(--tg-theme-button-color)] px-5 text-sm font-semibold text-[var(--tg-theme-button-text-color)]"
      >
        {copy.retry}
      </button>
    </div>
  );
}
