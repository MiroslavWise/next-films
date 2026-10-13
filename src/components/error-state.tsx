import { buttonClass, panelClass } from "@/lib/ui"
import { copy } from "@/lib/constants"

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={`${panelClass} p-6 text-center`}>
      <p className="text-base leading-relaxed text-(--danger)">{message}</p>
      <button type="button" onClick={onRetry} className={`${buttonClass} mt-4`}>
        {copy.retry}
      </button>
    </div>
  )
}
