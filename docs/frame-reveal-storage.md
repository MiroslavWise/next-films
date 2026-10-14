# Прояви кадр: геймплей и хранение

Документ для человека и для агента (Cursor). Фиксирует продуктовую модель игры `frame-reveal` («Прояви кадр»): постепенное открытие кадра сеткой поверх того же каталога кадров, что у «Угадай кадр».

Связанные факты проекта на момент написания:

- уже есть PostgreSQL + Prisma (`POSTGRES_URL`);
- каталог кадров — `FrameGuessEntry` (`movieId` unique, `frames` Json: `{ id, url, blurhash }[]`);
- игра `frame-guess` («Угадай кадр») уже **active**;
- игра `frame-reveal` в `src/lib/games.ts` — `status: "soon"` (карточка на главной);
- медиа — Vercel Blob + `/api/media/…`; вторую БД / новый Blob store не создавать.

---

## Вердикт

**Отдельный каталог кадров не нужен.** Переиспользуем `FrameGuessEntry` + тот же пайплайн AVIF/blurhash.

Отдельные таблицы нужны только для **партий и истории игрока** (как у `frame-guess` / плей-оффа): сессия + раунды с состоянием открытых клеток.

| Вопрос | Решение |
| --- | --- |
| Откуда кадры? | Тот же `FrameGuessEntry` |
| Сетка | **16 колонок × 9 рядов** = 144 клетки; контейнер `aspect-ratio: 16 / 9` |
| Старт раунда | 1 случайная клетка открыта, остальные — blur-маски |
| Действие игрока | «Открыть ещё» → ещё одна случайная закрытая клетка **или** ответ из 4 вариантов |
| Ответы | Как в «Угадай кадр»: правильный фильм + 3 дистрактора, shuffle на сервере |
| История | `FrameRevealSession` + `FrameRevealRound` (снимок кадра, открытые индексы, ответ) |

---

## Модель игры (продукт)

### Контент

Админка кадров уже есть (`/admin/movies/[id]/frames`). Для «Прояви кадр» достаточно тех же активных записей с непустым `frames`.

### Раунд

1. Сервер выбирает **случайную активную** `FrameGuessEntry`, затем **случайный кадр** из `frames` (по возможности без повторов в партии).
2. Строит сетку **16×9** (индексы клеток `0 … 143`, row-major: `index = row * 16 + col`).
3. Открывает **одну** случайную клетку; остальные закрыты.
4. Берёт **3 других** фильма из `Movie` (exclude правильный) → **4 варианта**, shuffle.
5. Клиенту: `imageUrl`, `imageBlurhash`, `options`, `openedCells: number[]`, `roundId` — **без** `correctMovieId`.
6. Игрок может:
   - нажать **«Открыть ещё»** → сервер добавляет ещё один случайный индекс из закрытых;
   - выбрать один из **4** фильмов → проверка на сервере → feedback → следующий раунд.
7. Если все 144 клетки открыты, кнопка «Открыть ещё» disabled; остаётся только ответ.

Правило качества кадра — то же, что у `frame-guess` (не постер, без читаемого тайтла).

### Почему 16×9

- Совпадает с **aspect-ratio 16/9** горизонтального кадра: клетки почти квадратные.
- Константы в коде: `REVEAL_COLS = 16`, `REVEAL_ROWS = 9`, `REVEAL_CELLS = 144` — не магические числа в SQL/UI.
- При необходимости позже можно уменьшить сетку (например 8×45… нет; разумные альтернативы 8×5 / 4×3) одной константой, не меняя каталог.

### UI клетки

- Контейнер: `aspect-video` (16/9).
- Под сеткой — полный кадр (`object-cover` / `contain` — как в frame-guess, landscape).
- Поверх: CSS-grid `16 × 9`. Закрытая клетка — полупрозрачный blur-слой (backdrop-blur / отдельный blurhash-плиточный оверлей), открытая — `pointer-events-none` + прозрачность.
- Не резать изображение на 144 файла в Blob: **один** url кадра + маска клеток на клиенте.

---

## Хранение (Postgres)

### Каталог

Без изменений: `FrameGuessEntry`.

### Партия и история (как плей-офф / frame-guess)

```prisma
enum FrameRevealSessionStatus {
  ACTIVE
  ENDED
}

model FrameRevealSession {
  id            String                   @id @default(uuid(7)) @db.Uuid
  userId        String
  status        FrameRevealSessionStatus @default(ACTIVE)
  correctCount  Int                      @default(0)
  answeredCount Int                      @default(0)
  createdAt     DateTime                 @default(now())
  updatedAt     DateTime                 @updatedAt
  endedAt       DateTime?

  user   TelegramUser       @relation(fields: [userId], references: [id], onDelete: Cascade)
  rounds FrameRevealRound[]

  @@index([userId, status])
  @@index([userId, createdAt])
}

model FrameRevealRound {
  id             String    @id @default(uuid(7)) @db.Uuid
  sessionId      String    @db.Uuid
  userId         String
  frameId        String
  imageUrl       String
  imageBlurhash  String
  correctMovieId String    @db.Uuid
  correctTitle   String
  /// [{ "movieId", "title" }, ...] — уже перемешанные
  options        Json
  /// Индексы открытых клеток 0..143
  openedCells    Json
  /// Сколько раз нажали «открыть ещё» (openedCells.length - 1 на старте)
  revealCount    Int       @default(0)
  chosenMovieId  String?   @db.Uuid
  isCorrect      Boolean?
  createdAt      DateTime  @default(now())
  answeredAt     DateTime?

  session FrameRevealSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
  @@index([userId, createdAt])
}
```

В `TelegramUser` — обратная связь `frameRevealSessions`.

### Контракт `openedCells`

```ts
type OpenedCells = number[] // уникальные int в [0, 143], длина ≥ 1
```

Валидация Zod: массив unique, min 1, max 144, каждый int в диапазоне.

### Античит

- `correctMovieId` только на сервере до ответа.
- «Открыть ещё» — **серверный** POST: клиент не может сам выставить все клетки открытыми без вызовов (или сервер игнорирует клиентский список и сам выбирает следующий индекс).
- Рекомендация: клиент шлёт только `{ roundId }`, сервер мутирует `openedCells`.

---

## API (контракт, черновик)

Базовый префикс: `/api/games/frame-reveal`.

| Метод | Путь | Назначение |
| --- | --- | --- |
| `GET` | `/sessions/current` | ACTIVE партия + текущий раунд или `404` |
| `POST` | `/sessions` | getOrCreate ACTIVE + раунд |
| `GET` | `/sessions` | История `ENDED` |
| `GET` | `/sessions/:id` | Детали партии (раунды) |
| `POST` | `/rounds/:id/reveal` | Открыть ещё одну клетку |
| `POST` | `/rounds/:id/answer` | `{ movieId }` → проверка + next round |
| `POST` | `/sessions/:id/finish` | `{ action: "home" \| "restart" }` |

Rate limit: отдельный bucket `frameReveal` (или общий с frame-guess).

Ответ раунда (пример):

```json
{
  "roundId": "<uuid>",
  "imageUrl": "…",
  "imageBlurhash": "…",
  "cols": 16,
  "rows": 9,
  "openedCells": [47],
  "revealCount": 0,
  "canRevealMore": true,
  "options": [
    { "movieId": "…", "title": "A" },
    { "movieId": "…", "title": "B" },
    { "movieId": "…", "title": "C" },
    { "movieId": "…", "title": "D" }
  ]
}
```

После `reveal`:

```json
{
  "openedCells": [47, 12],
  "revealCount": 1,
  "canRevealMore": true
}
```

---

## Клиент (кратко)

- Маршрут: `/games/frame-reveal` (когда снимем `soon`).
- UI: кадр 16/9 с сеткой → кнопка «Открыть ещё» + 4 варианта → feedback → следующий.
- Счёт партии: `correct/answered` в шапке; в истории — счёт + опционально средний `revealCount` (насколько рано угадали).
- Empty-state: нет активных кадров **или** `< 4` фильмов в каталоге — тот же порог, что у frame-guess.
- Карточка на главной уже в `games.ts` со статусом `soon`.

---

## Отличия от «Угадай кадр»

| | `frame-guess` | `frame-reveal` |
| --- | --- | --- |
| Кадр | Показан целиком | Сетка 16×9, клетки открываются |
| Действие кроме ответа | Нет | `POST …/reveal` |
| Каталог | `FrameGuessEntry` | Тот же |
| История | `FrameGuessSession/Round` | Отдельные `FrameRevealSession/Round` |

Не смешивать раунды двух игр в одной таблице: разный JSON-стейт (`openedCells` vs полный кадр).

---

## План реализации (чеклист)

1. Константы сетки + Zod `openedCells`.
2. Миграция `FrameRevealSession` / `FrameRevealRound`.
3. `src/lib/game/frame-reveal.ts`: createRound, revealCell, submitAnswer, finish, history.
4. API routes по таблице выше.
5. UI страница + снять `soon` в `games.ts`.
6. Переиспользовать catalog/availability из frame-guess (entries ≥ 1, movies ≥ 4).

---

## Инструкция для агента (Cursor)

При запросе «сделай Прояви кадр» / frame-reveal:

### Обязательно

- Кадры только из **`FrameGuessEntry`**. Не создавать второй каталог фото.
- Сетка **16×9**, один Blob-url на кадр, маска клеток на клиенте.
- Reveal и answer — серверные; клиент не доверяется как источнику `openedCells` / правильного ответа.
- История — отдельная сессия 1 ACTIVE на пользователя, `ENDED` в списке.
- UUID v7; стиль без `;`, Prettier проекта.
- JWT / rate-limit / media — существующие модули.

### Запрещено без явного запроса

- Резать кадр на 144 файла в Blob.
- Класть сетку в `Movie`.
- Mongo / второй Blob store.
- Свободный ввод названия вместо 4 вариантов.

### Критерии готовности

- Старт: ровно 1 открытая клетка.
- Reveal добавляет ровно одну новую закрытую клетку (пока есть закрытые).
- Ответ из 4; дистракторы ≠ правильный фильм.
- История показывает завершённые партии со счётом.
- `frame-guess` не ломается.

---

## FAQ

**«Нужна ли своя админка кадров?»**  
Нет. Та же страница «Кадры» у фильма.

**«144 клетки не слишком много?»**  
Для маски — нормально (CSS). Игрок редко откроет все: обычно угадывает раньше. Если UX покажет иное — уменьшим `REVEAL_COLS/ROWS` константами.

**«Можно ли открывать клетку тапом по ней?»**  
v1 — одна кнопка «Открыть ещё» (случайная клетка). Тап по конкретной клетке — опциональное усложнение (тогда сервер должен принять `cellIndex` и проверить, что она была закрыта).

**«Скоринг?»**  
Базовый: correct/answered. Опционально позже: бонус за меньший `revealCount`.

---

## Итог одной фразой

«Прояви кадр» — **тот же каталог кадров**, раунд с **сеткой 16×9** (aspect 16/9): клетки открываются по одной (остальные blur), ответ — **4 варианта**; история партий как у frame-guess, отдельными таблицами сессии/раунда.
