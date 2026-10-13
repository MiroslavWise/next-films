# Кино-плей-офф: где хранить турнир

Документ для человека и для агента (Cursor). Решает, нужна ли отдельная MongoDB на Vercel, и как реализовать игру без лишнего стека.

Связанные факты проекта на момент написания:

- уже есть PostgreSQL + Prisma (`POSTGRES_URL`);
- уже есть Upstash Redis через REST (`KV_REST_API_*`) — rate limit;
- фильмы, пользователи, голоса «Кино-выбора» живут в Postgres;
- игра `movie-playoff` в `src/lib/games.ts` пока `status: "soon"`.

---

## Вердикт

**MongoDB для «Кино-плей-офф» не подключать.**

Хранить турнир в **той же PostgreSQL**, одной строкой на партию, с JSONB-состоянием сетки. Обновление — атомарный `UPDATE` (аналог «put документа»), а не отдельная NoSQL-база.

Кратко почему:

| Критерий | MongoDB | Postgres JSONB (рекомендация) |
| --- | --- | --- |
| «Один документ на игру + put» | Да | Да (`Json` / `jsonb`) |
| Связь с `Movie` / `TelegramUser` | Отдельный клиент, ручные id | FK, транзакции, Prisma |
| Новый сервис на Vercel | Да (Atlas / Marketplace) | Нет |
| Стоимость / ops | +кластер, секреты, мониторинг | 0 |
| Конкурентные обновления | Нужен `version` / CAS | То же + SQL `WHERE version = $n` |
| Аналитика («сколько раз фильм доходил до финала») | Отдельные агрегации | SQL по JSONB / отдельная колонка `finalistMovieId` |
| Соответствие текущему стеку | Ломает «одна БД» | Совпадает с README: вторую БД не создавать |

MongoDB здесь даёт удобный mental model документа, но **тот же mental model уже есть в Postgres**. Цена — второй runtime, второй клиент, два источника правды для фильмов.

---

## Когда MongoDB всё же имело бы смысл

Только если одновременно верно несколько пунктов:

1. турнирная схема постоянно меняется и не укладывается в версионируемый JSON-контракт;
2. нагрузка — миллионы короткоживущих партий с тяжёлыми вложенными документами, и Postgres уже bottleneck;
3. команда уже живёт на Mongo, а Postgres только «каталог».

Для Mini App с 16 фильмами и 15 выборами (8+4+2+1) это не наш случай.

**Upstash Redis** как единственное хранилище партии — тоже не рекомендуем как source of truth: удобно для эфемерного кэша, плохо для истории, FK к фильмам и восстановления после закрытия Mini App через день. Redis можно позже использовать как опциональный кэш активной партии, не вместо Postgres.

---

## Модель игры (продукт)

1. Старт: выбрать **16** случайных фильмов из `Movie` (`ORDER BY random() LIMIT 16`).
2. Раунд 1: 8 пар → игрок выбирает победителя в каждой (можно UI: по одной паре за шаг).
3. Раунд 2: 4 пары из 8 победителей.
4. Раунд 3: 2 пары (полуфинал).
5. Раунд 4: 1 пара (финал) → **финалист**.
6. Состояние парти должно пережить перезагрузку / повторный вход в тот же Telegram-сеанс.

Числа фиксированы: bracket size = 16 = 2⁴. В коде — константа `PLAYOFF_SIZE = 16`, не магическое число в SQL.

---

## Рекомендуемое хранение (Postgres)

### Prisma-модель (черновик на реализацию)

```prisma
enum PlayoffStatus {
  ACTIVE
  COMPLETED
  ABANDONED
}

model PlayoffTournament {
  id               String        @id @default(uuid(7)) @db.Uuid
  userId           String
  status           PlayoffStatus @default(ACTIVE)
  /// 0 = 1/8 (16→8), 1 = 1/4, 2 = 1/2, 3 = финал, 4 = завершён
  roundIndex       Int           @default(0)
  /// Полный bracket: seed, пары, выборы, победители. Контракт — Zod + TypeScript.
  bracket          Json
  finalistMovieId  String?       @db.Uuid
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  /// Оптимистичная блокировка для PUT
  version          Int           @default(0)

  user     TelegramUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  finalist Movie?       @relation(fields: [finalistMovieId], references: [id], onDelete: SetNull)

  @@index([userId, status])
  @@index([userId, createdAt])
}
```

В `TelegramUser` и `Movie` добавить обратные связи `playoffs` / `playoffFinalists` при миграции.

### Форма `bracket` (логический документ)

Идея «как в Mongo» — весь прогресс в одном JSON:

```ts
type PlayoffMovieRef = {
  id: string
  title: string
  posterUrl: string
  posterBlurhash: string
}

type PlayoffMatch = {
  id: string // например "r0-m3"
  roundIndex: number
  slot: number
  leftMovieId: string
  rightMovieId: string
  winnerMovieId: string | null
}

type PlayoffBracket = {
  size: 16
  seedMovieIds: string[] // порядок посева 0..15
  movies: PlayoffMovieRef[] // денормализованный снимок на момент старта
  matches: PlayoffMatch[]
}
```

Посев фиксируется при `POST` старта. Дальше матчи создаются заранее (15 матчей) или лениво при переходе раунда — предпочтительно **заранее**: проще валидировать PUT.

Правило перехода:

- раунд `r` завершён, когда у всех матчей с `roundIndex === r` есть `winnerMovieId`;
- победители по порядку слотов образуют пары раунда `r + 1`;
- после финала: `status = COMPLETED`, `finalistMovieId = winner`, `roundIndex = 4`.

### Почему снимок постеров в JSON

Постеры/названия могут смениться в админке. Для уже начатой партии UI должен показывать то, что видел игрок при старте. Каталог `Movie` остаётся источником только для **нового** турнира.

---

## API (контракт)

Базовый префикс: `/api/games/movie-playoff`.

| Метод | Путь | Назначение |
| --- | --- | --- |
| `POST` | `/tournaments` | Создать турнир: 16 random фильмов, `bracket`, `status=ACTIVE`. Если у юзера уже есть `ACTIVE` — либо вернуть его (resume), либо 409 по политике продукта. **Рекомендация:** resume одной активной партии. |
| `GET` | `/tournaments/current` | Активный турнир текущего JWT-пользователя или `404`. |
| `GET` | `/tournaments/:id` | Турнир по id (только владелец). |
| `PUT` | `/tournaments/:id/pick` | Выбор победителя в матче. Тело ниже. |

Не делать «сырой put всего документа с клиента» без серверной валидации — клиент может подставить чужого финалиста. Клиент шлёт **намерение**, сервер мутирует bracket.

### Тело `PUT .../pick`

```json
{
  "matchId": "r0-m2",
  "winnerMovieId": "<uuid>",
  "version": 3
}
```

Ответ: обновлённый турнир + новый `version`.

Правила сервера:

1. JWT обязателен; `tournament.userId === auth.user.id`.
2. `status === ACTIVE`.
3. `version` совпадает с БД, иначе **409 Conflict** (клиент делает GET и повторяет).
4. `matchId` существует; `winnerMovieId` — один из `left`/`right` этого матча.
5. матч ещё без победителя; предыдущие матчи того же «пути» не нужны — достаточно что матч принадлежит текущему `roundIndex` (или разрешить доигрывать только текущий раунд по одной паре).
6. после записи победителя: если раунд закрыт — собрать следующий; если финал — `COMPLETED`.
7. инкремент `version`, `updatedAt`.

Rate limit: как у vote «Кино-выбора», ключ по `telegramUserId` + route.

---

## Клиент (кратко)

- Маршрут: `/games/movie-playoff` (когда снимем `soon`).
- Состояние: TanStack Query по `current` + мутация `pick`.
- UI: сетка 4×4 на старте опциональна; основной поток — **две карточки**, выбор одной, анимация перехода, прогресс раунда.
- При 409 — refetch и тост «состояние обновилось».
- Финал: экран финалиста + кнопка «ещё раз» → `POST` новой партии (старую оставить `COMPLETED`).

---

## Почему не «put всего Mongo-документа»

Предложенный подход «одна запись, put при каждом выборе» рабочий, но:

- клиент становится источником истины → читы и рассинхрон;
- сложнее audit («кто выиграл матч X»);
- Mongo не убирает нужду в optimistic locking (`version` / `_etag`).

В Postgres делаем **тот же документ** (`bracket` JSON), но **серверный** PATCH/PUT pick с проверками. Внешне для продукта — то же UX.

---

## План реализации (чеклист для человека)

1. Не создавать MongoDB / Atlas / второй Prisma datasource.
2. Добавить модель `PlayoffTournament` + миграция.
3. Zod-схемы `PlayoffBracket` / pick body в `src/lib/game/movie-playoff.ts` (или рядом).
4. API routes по таблице выше; auth через существующий JWT.
5. Страница игры + карточка на главной: `status: "active"`, `href: "/games/movie-playoff"`.
6. Seed/каталог: убедиться, что фильмов ≥ 16, иначе empty-state.
7. (Опционально) админ-метрика: топ финалистов по `finalistMovieId`.
8. Не трогать Vote / movie-choice counters логикой плей-оффа, пока продукт явно не попросит.

---

## Инструкция для агента (Cursor)

При запросе «сделай Кино-плей-офф» / storage / API:

### Обязательно

- Использовать **только Postgres + Prisma**. Не предлагать и не подключать MongoDB, Mongoose, второй datasource.
- Не создавать новые Blob / Redis / DB на Vercel, если текущие env уже работают.
- Одна активная партия на пользователя (resume); завершённые оставлять в БД.
- Состояние сетки — JSON в колонке `bracket`; мутации только через серверную функцию `applyPick`, не доверять полному документу с клиента.
- UUID v7 для id турнира; стиль кода — без `;`, Prettier проекта (`printWidth` 140).
- Читать актуальные гайды Next из `node_modules/next/dist/docs/` при роутинге/cache.
- JWT / rate-limit / media proxy — переиспользовать существующие модули (`auth`, `rate-limit`, `media`).

### Запрещено без явного запроса человека

- Подключать MongoDB Atlas / Vercel Mongo integration.
- Хранить турнир только в Upstash Redis без строки в Postgres.
- Писать голоса плей-оффа в таблицу `Vote` «Кино-выбора».
- Делать multiplayer / shared bracket.

### Порядок работ агента

1. Миграция Prisma + типы bracket.
2. `src/lib/game/movie-playoff.ts`: `createTournament`, `getCurrent`, `applyPick`.
3. API routes.
4. UI страница + активация в `games.ts`.
5. Empty-state при `< 16` фильмов.
6. Кратко описать человеку, что сделано; секреты не выводить.

### Критерии готовности

- Старт даёт 16 уникальных фильмов.
- 15 выборов доводят до `COMPLETED` и `finalistMovieId`.
- Повторный вход возвращает `ACTIVE` турнир.
- Чужой `userId` / чужой `matchId` / неверный `winner` / старый `version` → 401/403/400/409.
- Второго database provider в проекте нет.

---

## FAQ

**«Но документ удобнее в Mongo»**  
В Postgres колонка `Json` — тот же документ. Разница в ops, не в DX формы данных.

**«PUT документа проще, чем applyPick»**  
Проще писать, дороже защищать. Для Mini App с JWT и публичным API — серверная валидация обязательна в любом хранилище.

**«Нужна ли история всех партий?»**  
Да, оставлять `COMPLETED`. Дешёвые строки; полезно для «мои финалисты» и антифрода.

**«Можно ли потом мигрировать на Mongo?»**  
Да, JSON уже документ-ориентированный. Миграция не нужна заранее «на всякий случай».

---

## Итог одной фразой

Для «Кино-плей-офф» MongoDB на Vercel — лишний сервис; делаем **одну строку турнира в PostgreSQL с JSONB-bracket и серверным PUT pick + version**.
