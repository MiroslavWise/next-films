import { api } from "sdk"

export default async function (message) {
  if (message.text !== "/start") return
  await api.sendMessage({
    chat_id: message.chat.id,
    text: "Три фильма и три решения.\nОткрой мини-приложение:",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Играть",
            web_app: { url: "https://next-films-mu.vercel.app/" },
          },
        ],
      ],
    },
  })
}
