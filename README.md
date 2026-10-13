# Кино-выбор

Telegram Mini App: на главной список игр, первая игра показывает до трёх фильмов в ряд. Для каждого фильма пользователь выбирает «Много», «Один» или «Убрать». Голос сохраняется в PostgreSQL и увеличивает счётчик только один раз.

## Стек

- Next.js 16, React, TypeScript, Tailwind CSS
- Prisma и PostgreSQL (UUID v7 для сущностей каталога)
- Zod, Zustand, `jose` (JWT-сессия 12 часов)
- `@tma.js/sdk`, `@tma.js/sdk-react`, `@tma.js/init-data-node`
- Vercel Blob + `sharp` (AVIF) + [BlurHash](https://blurha.sh/) (компоненты 5×9 под постер 9:16; лимит библиотеки — до 9)
- Upstash Redis (`@upstash/ratelimit`, `@upstash/redis`)

## Установка

```bash
pnpm install
```

`postinstall` запускает `prisma generate`.

## PostgreSQL

Проект использует уже подключённую базу (`POSTGRES_URL`). Вторую базу создавать не нужно.

Идентификаторы фильмов, жанров, людей и голосов — UUID v7 (`@default(uuid(7)) @db.Uuid`). `TelegramUser.id` остаётся строковым id Telegram.

## Миграции и seed после смены схемы

Смена Int → UUID и поля BlurHash несовместимы со старыми таблицами. На **dev**-базе:

```bash
pnpm exec prisma migrate reset
pnpm exec prisma db seed
```

`migrate reset` **удаляет все данные** в этой базе. Не запускайте на production.

Seed идемпотентный по названиям: 12 фильмов, жанры, актёры, режиссёры, продюсеры. Постеры — `placehold.co` с заранее сгенерированным blurhash, без Blob.

## Локальный сервер

```bash
pnpm dev
```

Откройте http://localhost:3000.

Для проверки вне Telegram в `.env.local`:

```text
MOCK_TELEGRAM_USER=true
JWT_SECRET=<случайная длинная строка>
```

Mock работает только при `NODE_ENV !== production`. Mock-пользователь — первый id из `NEXT_ADMIN_IDS`.

## Авторизация

1. При входе Mini App клиент инициализирует `@tma.js/sdk` и один раз вызывает `POST /api/auth/session` с `x-telegram-init-data`.
2. Сервер проверяет initData через `@tma.js/init-data-node`, upsert пользователя и выдаёт JWT на **12 часов**.
3. JWT хранится только в памяти Zustand (`sessionToken`), **не пишется в БД**.
4. Дальнейшие запросы идут с `Authorization: Bearer <token>`.

## Бот в BotFather

1. [@BotFather](https://t.me/BotFather) → `/newbot`.
2. Токен в `NEXT_BOT_TOKEN` (не `NEXT_PUBLIC_…`).
3. Menu Button / Web App → URL после деплоя.

## Деплой на Vercel

1. Импорт репозитория, Framework Next.js.
2. Переменные из `.env.example`, включая `JWT_SECRET`.
3. URL в Menu Button бота.

## Переменные окружения

Обязательны в production:

- `POSTGRES_URL`
- `NEXT_BOT_TOKEN`
- `NEXT_ADMIN_IDS`
- `JWT_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`

## Blob и BlurHash

API принимает изображение до 4 МБ. `sharp` ресайзит, считает BlurHash (компоненты **5×9**, лимит библиотеки 1–9 на ось; визуально под постер 9:16), конвертирует в AVIF и кладёт только `.avif` в Blob. В ответах API есть `url` и `blurhash`. В UI placeholder через `react-blurhash`.

## Upstash

Rate limit через `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Пакет `@vercel/kv` не используется.

Лимиты: раунд 30/мин, голос 10/мин, фото 20/мин.

## Админка

`/admin` — если `isAdmin` в JWT (id из `NEXT_ADMIN_IDS`).

У фильма обязательны название и постер (+ blurhash с загрузки). Жанры и люди необязательны. У людей имя обязательно, фото нет.

## Допущения

- Название фильма уникально.
- Имена людей и жанров уникальны без учёта регистра.
- Счётчики голосов из админки не редактируются.
- Раунд: три карточки в ряд на одном экране.

## Возможные проблемы

- 401 вне Telegram: откройте Mini App или `MOCK_TELEGRAM_USER`.
- 401 после истечения JWT: клиент сам перезапросит `/api/auth/session`.
- 429: подождите минуту.
- Ошибка Prisma: проверьте `POSTGRES_URL` в `.env`.
- Старая схема Int: сделайте `migrate reset` + seed на dev-базе.
