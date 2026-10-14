# Telegram Serverless в next-films

Документ для человека и для агента (Cursor). Как устроен [Telegram Serverless](https://core.telegram.org/bots/serverless) и **что из него имеет смысл именно в этом приложении** — Mini App с играми про фильмы на Next.js / Vercel / Postgres.

Источник: [core.telegram.org/bots/serverless](https://core.telegram.org/bots/serverless) (в т.ч. обновление 6 октября 2026: hosting фронта Mini App + `endpoints`).

---

## Вердикт для next-films

**Не переносить весь бэкенд и админку на Telegram Serverless.**

Оставить ядро на Vercel + Postgres + Prisma + Blob. Serverless подключать **точечно** как слой бота Telegram:

1. **handlers** — ответы на `/start`, кнопки, напоминания, deep link в Mini App;
2. опционально **лёгкие endpoints** — только то, что не требует каталога фильмов, Blob и админ-CRUD;
3. **не** хостить Next.js-фронт на `*.tgcloud.ai` пока приложение — полноценный App Router с API routes и серверной сессией.

Кратко почему:

| Что нужно next-films | Vercel + Postgres (сейчас) | Telegram Serverless |
| --- | --- | --- |
| Каталог фильмов, жанры, актёры, FK | Prisma + Postgres | SQLite **без foreign keys** |
| Постеры / фото в Blob | `@vercel/blob` | Нет Blob; файлы через Bot API ≤50 MB |
| Админка CRUD | Next.js API + сессия | Нет npm, нет Prisma, нет удобного admin UI |
| Игры с голосами (`Vote`, счётчики) | Транзакции, уникальность `(userId, movieId)` | Можно, но дублирует Postgres |
| Бот: `/start`, reply keyboard, push в чат | Сейчас почти нет | **Сильная сторона** Serverless |
| Auth Mini App | Сами валидируем `initData` + JWT | В endpoints `initData` уже проверен платформой |
| Rate limit | Upstash | Свой код / своя SQLite |

Serverless здесь — не замена Vercel, а **дешёвый always-on бот** рядом с Mini App.

### Посетители Mini App (сделано)

- Профили заходов: SQLite `profiles` (`id`, `username`, `firstName`, `lastVisit`) через `endpoints/trackVisit` и `endpoints/listUsers`.
- Админы для `listUsers`: `bot/tgcloud/lib/admins.js` — **синхронизировать вручную** с `NEXT_ADMIN_IDS`.
- Postgres `TelegramUser` создаётся только при игровом действии (например голос в movie-choice), не при каждом открытии сессии.
- Клиент: `telegram-web-app.js` + `src/lib/telegram/serverless-call.ts`; админка `/admin/users`.

---

## Что такое Telegram Serverless (сжато)

Бэкенд бота и Mini App крутится **на инфраструктуре Telegram**: V8-isolate, без VPS и без своего webhook-сервера.

Три зоны:

| Где | Что |
| --- | --- |
| Локальная папка `tgcloud/` | JS-модули: `schema.js`, `handlers/`, `endpoints/`, `lib/` |
| Cloud Telegram | Задеплоенный код, SQLite бота, статика Mini App |
| CLI `npx tgcloud` | `login` / `push` / `migrate` / `run` / `status` |

Структура:

```text
tgcloud/
├─ endpoints/   # вызовы из Mini App: Telegram.WebApp.Serverless.call('name', …)
├─ handlers/    # реакция на update: message, callback_query, …
├─ lib/         # общий код
└─ schema.js    # таблицы SQLite (DSL как у Drizzle)
```

Включить: [@BotFather](https://t.me/BotFather) → бот → **Serverless**. CLI-токен (`app<id>:<secret>`) отдельный от `NEXT_BOT_TOKEN`.

Ограничения рантайма (важны для планирования):

- только **plain JS**, **без npm** и без Node API;
- импорты только `sdk` / `sdk/db` / `sdk/api` / `sdk/fetch` и модули внутри `tgcloud/`;
- БД — **SQLite**, `PRAGMA foreign_keys` выключен (`.references()` запрещены);
- исходящий HTTP — `fetch` из SDK, ответ ≤ 30 MB;
- деплой кода и миграции схемы **разделены**: `push`, потом `migrate`.

Mini App (опционально):

- статика из `tgcloud.jsonc` → `static.source` (обычно `dist`);
- URL вида `https://app<app_id>.tgcloud.ai/`;
- endpoints: `POST /api/<name>` через `Telegram.WebApp.Serverless.call`;
- Next.js / Nuxt / SvelteKit **не подхватываются сами** — нужен static export, иначе `source` не настроить «из коробки».

---

## Как устроен next-films сейчас

Связанные факты на момент написания:

- Mini App: Next.js App Router на Vercel (`src/app/…`);
- сессия: `x-telegram-init-data` → `validateInitData` → JWT (`src/lib/auth.ts`, `src/app/api/auth/session`);
- данные: Postgres + Prisma (`Movie`, `Vote`, `TelegramUser`, жанры/люди);
- медиа: Vercel Blob + прокси `/api/media/…`;
- игры: активна `movie-choice`; `movie-playoff` / `frame-guess` / `quotes` — soon;
- UI Telegram: `@tma.js/sdk` в `TelegramProvider`, BackButton / MainButton;
- бот как conversational layer почти не задействован — приложение открывается как Web App.

Итог: **тяжёлая доменная логика уже на Vercel**. Serverless выгоден там, где нужен бот без поднятия отдельного webhook-сервиса.

---

## Стратегии использования

### A. Гибрид (рекомендуется)

| Слой | Где живёт |
| --- | --- |
| UI игр, админка, каталог, голоса, Blob | Next.js на Vercel (как сейчас) |
| `/start`, меню, уведомления, deep link | `tgcloud/handlers/*` |
| URL Mini App в BotFather | текущий Vercel URL (не `*.tgcloud.ai`) |

Плюсы: минимум миграции, один source of truth в Postgres, Serverless закрывает «дыру бота».

Минусы: два деплоя (`vercel` + `tgcloud push`), два токена.

### B. Serverless endpoints + фронт на Vercel

Mini App по-прежнему с Vercel, но часть API зовёт через `Telegram.WebApp.Serverless.call`.

Имеет смысл только для данных, которым **не нужен** каталог в Postgres (лидерборд в SQLite бота, флаги «уже видел туториал», черновик партии).  
Для `movie-choice` vote/round — **нет**: фильмы и счётчики уже в Prisma.

Технический нюанс: `Serverless.call` рассчитан на Mini App, задеплоенный/привязанный к тому же serverless-проекту бота. Смешивать «фронт на Vercel + call в tgcloud» нужно проверять на практике; безопаснее считать endpoints частью полного tgcloud-хостинга (стратегия C) или не строить на этом критичный путь.

### C. Полный перенос Mini App на tgcloud hosting

Собрать статику (Vite/React или `next export` / static export), положить в `static.source`, endpoints вместо `/api/games/…`.

**Сейчас не рекомендуем:** ломает App Router API, Prisma, Blob-админку, SSR/Route Handlers. Имеет смысл только если продукт сузится до лёгкой статики без админки и без тяжёлого каталога.

---

## Конкретные сценарии для этого приложения

### 1. Бот-вход в Mini App (высокий приоритет)

`handlers/message.js` (и при необходимости `callback_query.js`):

- на `/start` — приветствие + кнопка `web_app` с URL текущего деплоя;
- команды `/games`, `/help`;
- deep link `start_param` → конкретная игра (`movie-choice`, позже `movie-playoff`).

Это закрывает UX «открыл бота в чате — попал в приложение» без отдельного Node-webhook на Vercel.

Пример идеи (псевдокод под SDK):

```js
// tgcloud/handlers/message.js
import { api } from 'sdk'

export default async function (message) {
  if (message.text !== '/start') return
  await api.sendMessage({
    chat_id: message.chat.id,
    text: 'Три фильма и три решения. Открой мини-приложение:',
    reply_markup: {
      inline_keyboard: [[{
        text: 'Играть',
        web_app: { url: 'https://YOUR-VERCEL-APP.vercel.app/' },
      }]],
    },
  })
}
```

URL брать из прод-домена / Vercel, не хардкодить preview без нужды.

### 2. Напоминания и «мягкий» re-engagement

Через `api.sendMessage` / `api.sendPhoto` из handlers или из endpoint, если когда-нибудь появится триггер из Mini App:

- «новый раунд Кино-выбора»;
- «доиграй плей-офф» (когда появится `movie-playoff`).

Состояние «кому слали» можно держать в SQLite Serverless (`schema.js`), не трогая Postgres. Каталог фильмов при этом **не дублировать** — в сообщении только текст/кнопка WebApp, без копирования постеров в SQLite.

### 3. Профили посетителей и флаги в SQLite бота

Уже используется для **всех, кто открыл Mini App** (`trackVisit` → `profiles`). Дополнительно подойдёт для:

- `seenTutorial` и прочих UI-флагов бота;
- «кому слали напоминание»;
- черновика UI плей-офф **только если** не пишете его в Postgres (см. `docs/movie-playoff-storage.md`).

Не подходит как source of truth для:

- `Movie` + счётчики;
- игровых `Vote` / участников игр (они в Postgres по мере игры);
- админских сущностей и Blob URL.

### 4. Прокси к Vercel API из handler (осторожно)

SDK `fetch` может дернуть ваш `https://…/api/…`. Так можно, например, из бота запросить публичную статистику.

Минусы: нужен отдельный секрет/подпись (у бота нет JWT Mini App), rate limit, два hop. Для игрового цикла внутри Mini App лучше оставить прямые Next.js API routes как сейчас.

### 5. Чего не делать на Serverless в этом репо

- Не переносить админку (`/admin`, upload photos, CRUD movie/people).
- Не дублировать схему Prisma в `schema.js` «один в один».
- Не ожидать Prisma / Zod / `@tma.js` внутри `tgcloud/` — там только SDK.
- Не включать Serverless hosting фронта, пока сборка — Next.js без осознанного static export.
- Не смешивать два webhook: при включённом Serverless webhook ведёт платформа (`npx tgcloud webhook`). Свой `setWebhook` на Vercel для того же бота будет конфликтовать.

---

## Рекомендуемый путь внедрения

1. В BotFather включить **Serverless** для текущего бота (тот же, чей `NEXT_BOT_TOKEN` в `.env.local`).
2. В корне репо **или** в отдельной папке `bot/` (предпочтительно отдельно, чтобы не путать с Next):

   ```bash
   npm create @tgcloud/bot .
   npx tgcloud login
   ```

3. Добавить только `handlers/message` (+ при необходимости `callback_query`) под `/start` и кнопку Web App на Vercel URL.
4. `npx tgcloud push` (миграции SQLite — только когда появятся таблицы).
5. Проверить, что webhook in sync: `npx tgcloud webhook` / `webhook sync`.
6. Mini App URL в BotFather оставить на Vercel.
7. Endpoints и `static` в `tgcloud.jsonc` **не включать**, пока нет явного кейса вне Postgres.

Отдельный git-репозиторий для `tgcloud/` допустим, если не хотите мешать CLI/AGENTS.md Telegram с Next-стеком. В монорепо — папка `bot/` + игнор `.tgcloud/`.

---

## Как это стыкуется с текущим auth

| Канал | Auth |
| --- | --- |
| Mini App → Vercel `/api/*` | `initData` в заголовке, проверка `NEXT_BOT_TOKEN`, JWT cookie/store |
| Mini App → Serverless endpoint | Платформа сама проверяет init data → `ctx.initData.user` |
| Пользователь пишет боту | Telegram User id в `message.from` / `callback_query.from` |

Идентификатор пользователя Telegram общий. При гибриде можно связывать `TelegramUser.id` в Postgres с тем же `user.id` из бота, **не** копируя сессионную логику Next в Serverless.

---

## CLI-шпаргалка

```bash
npx tgcloud login
npx tgcloud status
npx tgcloud diff
npx tgcloud push
npx tgcloud migrate          # только после изменений schema.js
npx tgcloud run handlers/message '{ chat: { id: 1 }, text: "/start", from: { id: 1 } }'
npx tgcloud webhook
npx tgcloud webhook sync
```

CI: токен в `TGCLOUD_TOKEN` (не коммитить; как и остальные секреты в `.env*`).

---

## Связь с другими docs

- `docs/movie-playoff-storage.md` — турнир хранить в **Postgres**, не в Mongo и не обязательно в SQLite Serverless.
- `docs/first-prompt.md` — исходный продуктовый промпт (Vercel-центричный стек); Serverless его не отменяет, а дополняет бот-слоем.

---

## Итог одной строкой

**Serverless = бот и опционально лёгкое состояние рядом с Telegram; next-films = каталог, игры, админка и медиа на Vercel.** Начать с `handlers` для `/start` + Web App button — максимальная польза при минимальном риске.
