import { api, fetch } from "sdk"

const APP_URL = "https://next-films-mu.vercel.app"

export default async function (message) {
  if (message.text !== "/start") return

  let total = null
  try {
    const res = await fetch(`${APP_URL}/api/stats/movies`)
    if (res.ok) {
      const data = await res.json()
      if (typeof data.total === "number") total = data.total
    }
  } catch {
    // ignore — приветствие без числа
  }

  const text =
    total != null
      ? `Три фильма и три решения.\nВ каталоге уже ${total} фильмов.\nОткрой мини-приложение:`
      : `Три фильма и три решения.\nОткрой мини-приложение:`

  await api.sendMessage({
    chat_id: message.chat.id,
    text,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Играть",
            web_app: { url: `${APP_URL}/` },
          },
        ],
      ],
    },
  })
}
