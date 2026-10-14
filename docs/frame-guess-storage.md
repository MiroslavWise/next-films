# Угадай кадр: хранение кадров в БД

Документ для человека и для агента (Cursor). Фиксирует модель данных и геймплей игры `frame-guess` («Угадай кадр»).

Связанные факты проекта на момент написания:

- уже есть PostgreSQL + Prisma (`POSTGRES_URL`);
- медиа — Vercel Blob + прокси `/api/media/…`; обработка upload — AVIF + blurhash в `src/lib/photos.ts`;
- у постеров/фото людей уже есть пара `url` + `blurhash`;
- игра `frame-guess` в `src/lib/games.ts` пока `status: "soon"`;
- каталог фильмов — `Movie`; вторую БД / Mongo / новый Blob store не создавать.

---

## Вердикт

**Одна отдельная таблица, одна запись на фильм (`movieId` unique), кадры — JSON-массив объектов в колонке `frames`.**

| Вопрос | Решение |
| --- | --- |
| Нужна ли отдельная таблица? | Да. Кадры — контент игры, не колонка в `Movie`. |
| Связь с фильмом | **1:1** — `movieId @unique` |
| Формат кадров | **JSONB-массив** `[{ id, url, blurhash }, …]` |
| CSV через запятую? | **Нет** |
| `text[]` только URL? | **Нет** — нужен blurhash на каждый кадр |
| Дочерняя таблица на кадр? | Не нужна для v1: объём кадров небольшой, модель «одна строка = один фильм» проще |

Почему не CSV: нельзя надёжно хранить blurhash, апдейтить один кадр, валидировать Zod’ом.  
Почему не `String[]`: только URL без метаданных — ломает BlurImage и единый пайплайн с постерами.  
Почему JSON-массив объектов: один row на фильм, при этом у каждого кадра есть `url` + `blurhash` (+ стабильный `id` для удаления в админке).

---

## Модель игры (продукт)

### Контент

1. В админке для фильма создаётся **одна запись** в таблице кадров (upsert по `movieId`).
2. В запись загружают ≥ 1 кадр. Каждый upload проходит тот же пайплайн, что постеры: **resize → AVIF → Vercel Blob → blurhash**.
3. В `frames` кладётся объект `{ id, url, blurhash }` (не сырой файл, не base64).

Правило качества: кадр не должен быть постером и не должен содержать читаемый тайтл/логотип (чеклист админки, не constraint БД).

### Раунд

1. Сервер выбирает **случайную активную запись** из таблицы кадров (`ORDER BY random() LIMIT 1`).
2. Из массива `frames` этой записи выбирает **случайный кадр**.
3. Из каталога `Movie` выбирает ещё **3 других фильма**, **исключая** фильм выбранной записи.
4. Четыре варианта ответа (правильный + 3 дистрактора) **перемешиваются** на сервере.
5. Клиенту отдаются: изображение кадра (+ blurhash), список из 4 вариантов (`movieId` + `title`), opaque `roundId` / token — **без пометки, какой вариант верный**.
6. Игрок выбирает один из четырёх → сервер проверяет → feedback → следующий раунд.

Минимум для старта раунда: в таблице ≥ 1 активная запись с непустым `frames`, в `Movie` ≥ 4 фильма (иначе не набрать 3 дистрактора).

---

## Хранение (Postgres)

### Prisma-модель

```prisma
model FrameGuessEntry {
  id        String   @id @default(uuid(7)) @db.Uuid
  /// Одна запись на фильм
  movieId   String   @unique @db.Uuid
  /// [{ "id": "<uuid>", "url": "...", "blurhash": "..." }, ...]
  frames    Json
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  movie Movie @relation(fields: [movieId], references: [id], onDelete: Cascade)

  @@index([isActive])
}
```

В `Movie` добавить обратную связь `frameGuessEntry FrameGuessEntry?`.

### Контракт элемента `frames` (Zod + TypeScript)

```ts
type FrameGuessFrame = {
  id: string // uuid v7 — для удаления/замены в админке
  url: string // Vercel Blob URL после AVIF
  blurhash: string
}

// frames: FrameGuessFrame[], длина ≥ 1 для участия в ротации
```

- Не хранить CSV и не хранить «голые» URL без blurhash.
- Порядок в массиве = порядок в админке; на random в игре не влияет.
- `isActive: false` на записи выключает весь фильм из ротации (массив кадров при этом не трогаем).

### Выбор записи и кадра

```ts
// псевдокод сервера
const entry = await prisma.frameGuessEntry.findFirst({
  where: { isActive: true, NOT: { frames: { equals: [] } } }, // плюс проверка длины в коде/сыром SQL
  orderBy: { /* random — через $queryRaw */ },
})

const frames = FrameGuessFrameSchema.array().parse(entry.frames)
const frame = frames[Math.floor(Math.random() * frames.length)]
```

Практичнее random записи через `$queryRaw`:

```sql
SELECT *
FROM "FrameGuessEntry"
WHERE "isActive" = true
  AND jsonb_array_length("frames") > 0
ORDER BY random()
LIMIT 1;
```

### Дистракторы

```ts
const distractors = await prisma.movie.findMany({
  where: { id: { not: entry.movieId } },
  select: { id: true, title: true },
  take: 3,
  // random: $queryRaw ORDER BY random() LIMIT 3
})
```

Если фильмов кроме правильного меньше 3 — раунд не создавать, вернуть empty-state / 503 с понятным кодом.

Перемешивание вариантов — **только на сервере** (`shuffle` Фишера–Йейтса), один раз при создании раунда. Клиент рисует массив `options` как есть.

### Античит

В payload раунда клиенту:

- отдать: `roundId`, `imageUrl` (proxy), `imageBlurhash`, `options: [{ movieId, title }, …]` (уже shuffled);
- **не** отдавать: индекс правильного ответа, отдельное поле `correctMovieId`, сырой `entry.id` если он = movie-связке без нужды.

Правильный `movieId` хранить только на сервере (строка раунда в БД / signed token с TTL). Проверка — `POST .../answer` с выбранным `movieId`.

---

## Медиа (AVIF + blurhash)

Каждый кадр обрабатывается **тем же пайплайном**, что постеры/фото:

1. Upload в админке → `src/lib/photos.ts` (sharp → AVIF, `encode` blurhash).
2. `put` в существующий Vercel Blob, pathname вида `frame-guess/{movieId}/{frameId}.avif`.
3. В `frames` пишем уже готовые `{ id: frameId, url, blurhash }`.

- Новый Blob store не создавать.
- Показ — через media proxy, как постеры.
- При удалении кадра / всей записи / фильма — `del` соответствующих Blob URL.
- Не класть оригинальный JPEG/PNG в БД и не дублировать кадры в `Movie.posterUrl`.

---

## API (контракт, черновик)

### Админка

Базовый префикс: `/api/admin/frame-guess` (или `/api/admin/movies/:movieId/frame-guess`).

| Метод | Путь | Назначение |
| --- | --- | --- |
| `GET` | `/entries/:movieId` | Запись + `frames` или `404` |
| `PUT` | `/entries/:movieId` | Upsert записи (`isActive`); создать с `frames: []`, если ещё нет |
| `POST` | `/entries/:movieId/frames` | Upload → AVIF+blurhash → append в `frames` |
| `DELETE` | `/entries/:movieId/frames/:frameId` | Убрать элемент из массива + `del` Blob |
| `PATCH` | `/entries/:movieId` | Только `isActive` (вкл/выкл фильма в игре) |

Доступ — admin auth, как у остальных `/api/admin/*`.

### Игра (Mini App)

Базовый префикс: `/api/games/frame-guess`.

| Метод | Путь | Назначение |
| --- | --- | --- |
| `POST` | `/rounds` | Random entry → random frame → 3 distractors → shuffle → ответ клиенту |
| `POST` | `/rounds/:id/answer` | Тело `{ "movieId": "<uuid>" }` → `{ correct, correctMovieId, … }` |

Rate limit: по `telegramUserId` + route, как у других игр.

Ответ `POST /rounds` (пример):

```json
{
  "roundId": "<uuid>",
  "imageUrl": "https://…/api/media/…",
  "imageBlurhash": "…",
  "options": [
    { "movieId": "…", "title": "Фильм A" },
    { "movieId": "…", "title": "Фильм B" },
    { "movieId": "…", "title": "Фильм C" },
    { "movieId": "…", "title": "Фильм D" }
  ]
}
```

---

## Клиент (кратко)

- Маршрут: `/games/frame-guess` (когда снимем `soon` в `games.ts`).
- UI: кадр (BlurImage) + **4 кнопки** с названиями → feedback → следующий раунд.
- Админка: блок «Кадры для Угадай кадр» на странице фильма — список превью из `frames`, upload, удаление, тумблер `isActive`.
- Empty-state: нет активных записей с кадрами **или** в каталоге `< 4` фильмов.

---

## План реализации (чеклист)

1. Миграция: `FrameGuessEntry` (`movieId` unique, `frames` Json).
2. Zod-схема `FrameGuessFrame` + хелперы append/remove кадра.
3. Admin API: upsert entry, upload кадра (AVIF+blurhash+Blob), delete frame.
4. UI в админке фильма.
5. `POST /rounds` + `POST /answer` (random entry/frame, 3 distractors, shuffle).
6. Страница игры + `status: "active"` в `games.ts`.
7. Наполнить ≥ 4 фильма с кадрами перед анонсом.

---

## Инструкция для агента (Cursor)

При запросе «сделай Угадай кадр» / storage / кадры / frame-guess:

### Обязательно

- **Одна таблица** `FrameGuessEntry`, связь **1:1** с `Movie` через `movieId @unique`.
- Кадры — колонка **`frames` Json**: массив `{ id, url, blurhash }`, не CSV, не `String[]`.
- Upload каждого кадра: **AVIF + blurhash** через существующий `src/lib/photos.ts` + Blob.
- Раунд: random entry → random frame → **3 других** `Movie` (exclude correct) → **shuffle** options на сервере.
- Клиенту до ответа не светить правильный `movieId` отдельным полем.
- Только Postgres + Prisma; новый Blob store / вторую БД не создавать.
- UUID v7; стиль кода — без `;`, Prettier проекта (`printWidth` 140).
- JWT / rate-limit / media / admin auth — переиспользовать существующие модули.
- Читать актуальные гайды Next из `node_modules/next/dist/docs/` при роутинге/cache.

### Запрещено без явного запроса человека

- CSV / `text[]` только URL.
- Класть массив кадров прямо в модель `Movie`.
- Отдельную таблицу на каждый кадр (нормализацию) — v1 зафиксирован как JSON в одной строке.
- Свободный ввод названия вместо 4 вариантов (продукт — quiz из 4).
- Подключать Mongo / Redis как source of truth каталога кадров.

### Порядок работ агента

1. Prisma `FrameGuessEntry` + миграция.
2. Admin CRUD entry/frames + upload pathname `frame-guess/…`.
3. `createRound` / `submitAnswer`.
4. UI админки, затем UI игры + активация в `games.ts`.
5. Кратко описать человеку, что сделано; секреты не выводить.

### Критерии готовности

- На один `movieId` — максимум одна запись (unique / upsert).
- Каждый кадр в `frames` имеет Blob-AVIF URL и blurhash.
- Раунд всегда отдаёт ровно 4 перемешанных варианта; правильный фильм среди них ровно один.
- Дистракторы не включают фильм кадра.
- Ответ проверяется на сервере.
- Второго database provider нет.

---

## FAQ

**«Почему не колонка в `Movie`?»**  
Игра опциональна; кадры — отдельный контент. Не мешаем movie-choice / playoff.

**«Почему JSON, а не дочерняя таблица?»**  
Продуктовая модель — «одна запись на фильм с массивом кадров». Объём маленький; админка и random entry проще. При росте (сотни кадров, аналитика по кадру) можно вынести stills позже — контракт `{ id, url, blurhash }` к этому готов.

**«Откуда 3 лишних фильма?»**  
Из всего каталога `Movie`, кроме фильма выбранной записи. Не обязательно, чтобы у дистракторов тоже были кадры.

**«Как хранить историю игрока (как в плей-оффе)?»**  
Как турнир в плей-оффе, только единица истории — **партия** `FrameGuessSession`:

- `ACTIVE` — одна текущая партия на пользователя (resume);
- `ENDED` — попадает в список истории со счётом `correctCount/answeredCount`;
- внутри партии — строки `FrameGuessRound` со снимком кадра, вариантов и ответа.

Каталог `FrameGuessEntry` от истории не зависит.

---

## Итог одной фразой

Для «Угадай кадр» — **одна строка на фильм (`movieId` unique) с JSON-массивом кадров (AVIF url + blurhash)**; раунд = random запись → random кадр → **+3 чужих фильма → shuffle из 4 ответов**.
