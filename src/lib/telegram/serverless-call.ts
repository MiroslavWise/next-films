type ServerlessError = {
  message?: string
  type?: string
  parameters?: Record<string, unknown>
}

type ServerlessCallback = (err: ServerlessError | null, result?: unknown) => void

type TelegramServerless = {
  call: {
    (name: string, callback: ServerlessCallback): void
    (name: string, input: Record<string, unknown>, callback: ServerlessCallback): void
  }
}

function getServerless(): TelegramServerless | null {
  if (typeof window === "undefined") return null
  const tg = (window as Window & { Telegram?: { WebApp?: { Serverless?: TelegramServerless } } }).Telegram
  return tg?.WebApp?.Serverless ?? null
}

export function isServerlessAvailable() {
  return getServerless() != null
}

export function serverlessCall<T>(name: string, input: Record<string, unknown> = {}): Promise<T> {
  const serverless = getServerless()
  if (!serverless) {
    return Promise.reject(new Error("Telegram Serverless недоступен"))
  }

  return new Promise((resolve, reject) => {
    const onResult: ServerlessCallback = (err, result) => {
      if (err) {
        reject(new Error(err.message || err.type || "Ошибка Serverless"))
        return
      }
      resolve(result as T)
    }
    if (Object.keys(input).length === 0) {
      serverless.call(name, onResult)
      return
    }
    serverless.call(name, input, onResult)
  })
}
