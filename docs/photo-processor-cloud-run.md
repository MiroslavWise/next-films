# Photo processor: Go-сервис на Cloud Run

Спецификация для отдельного репозитория (Golang). Документ можно перенести целиком в новый repo как `README.md` / `docs/SPEC.md`.

Цель сервиса: **принять исходное изображение → resize → AVIF → blurhash → загрузить в Vercel Blob → сообщить бэкенду next-films** метаданные для записи в PostgreSQL.

Сервис **не** пишет в Postgres и **не** знает про Prisma/игры. Владелец БД — Next.js API в `next-films`.

Связанный код в монолите (на момент написания):

- пайплайн: `src/lib/photos.ts` (`storePhoto`);
- константы: `src/lib/constants.ts`;
- upload API: `src/app/api/admin/photos/route.ts`, `src/app/api/admin/movies/[id]/frame-guess/frames/route.ts`;
- private Blob + прокси чтения: `/api/media/[...path]`.

---

## Вердикт

| Вопрос | Решение |
| --- | --- |
| Где крутится энкод? | **Google Cloud Run** (Go) |
| Куда класть файл? | Тот же **Vercel Blob** (private), что и сейчас |
| Кто пишет в PostgreSQL? | Только **next-films** (после webhook / sync-ответа) |
| Пишет ли Go в БД? | **Нет** |
| Видит ли браузер Cloud Run? | **Нет** — только server-to-server из Next (или signed job) |
| Sync или async? | Предпочтительно **async + webhook**; sync допустим для v1 |

---

## Архитектура

```text
Админ (браузер)
    │
    ▼
next-films (Vercel)
    │  1. auth админа, rate limit, создать jobId / entityId
    │  2. POST на Cloud Run (байты или sourceUrl)
    │
    ▼
photo-processor (Cloud Run, Go)
    │  detect mime → rotate/exif → resize → remove alpha
    │  blurhash + AVIF
    │  PUT в Vercel Blob (private)
    │
    ├─ sync: 200 JSON { entityId, url, blurhash, … }
    │         → Next пишет Postgres / отдаёт админке
    │
    └─ async: POST webhook на Next
              → Next пишет Postgres, job = DONE
```

### Ответственность

| Компонент | Делает | Не делает |
| --- | --- | --- |
| **Cloud Run** | валидация изображения, AVIF, blurhash, Blob `put`, webhook | JWT Telegram, Prisma, frame-guess бизнес-логика |
| **next-films** | admin auth, job lifecycle, Postgres, `appendFrameGuessFrame`, отдача URL клиенту | тяжёлый AVIF (после миграции) |

---

## Параметры обработки (совместимость с текущим `storePhoto`)

Держать значения идентичными next-films, пока явно не решите менять.

| Параметр | Значение | Примечание |
| --- | --- | --- |
| `MAX_UPLOAD_BYTES` | `2 * 1024 * 1024` (2 MiB) | до обработки |
| `POSTER_MAX_WIDTH` | `800` | `kind=poster` |
| `PORTRAIT_MAX_WIDTH` | `640` | `kind=portrait` |
| `FRAME_MAX_WIDTH` | `1280` | `kind=frame` |
| Resize | `fit=inside`, **без upscale** | как `withoutEnlargement: true` |
| EXIF | применить orientation (`rotate`) | |
| Alpha | убрать перед AVIF | меньше файл |
| AVIF quality | `38` | 1–100 |
| AVIF effort | `6` | 0–9; на Cloud Run можно оставить 6 |
| Chroma | `4:2:0` | |
| Blurhash poster/portrait | `5 × 9` | портрет ~9:16 |
| Blurhash frame | `9 × 5` | landscape ~16:9 |
| Output MIME | `image/avif` | |
| ID сущности | UUID (лучше UUID v7) | если не передан — сгенерировать |

### Допустимые входные MIME

`image/jpeg`, `image/jpg`, `image/pjpeg`, `image/png`, `image/x-png`, `image/webp`, `image/avif`, `image/gif`.

Если `Content-Type` пустой/врёт (часто Telegram/ОС) — определять по **magic bytes** и расширению имени файла (логика как в `detectImageMime` в `photos.ts`).

---

## Пути в Vercel Blob

Store: **private**. Upload с `addRandomSuffix=false`, `allowOverwrite=true` (как сейчас).

| `kind` | Pathname | Условие |
| --- | --- | --- |
| `poster` | `posters/{entityId}.avif` | всегда |
| `portrait` | `people/{entityId}.avif` | всегда |
| `frame` | `frame-guess/{movieId}/{entityId}.avif` | `movieId` обязателен и валидный UUID |

Ответ Blob API даёт итоговый `url` — его и нужно вернуть Next (через sync JSON или webhook). Клиенты читают картинки **не напрямую**, а через прокси next-films `/api/media/...`.

---

## HTTP API сервиса (Cloud Run)

Базовый префикс: `/v1`.

### `GET /healthz`

Проверка живости для Cloud Run / LB.

```json
{ "ok": true }
```

### `POST /v1/process`

Основной эндпоинт. Вызывается **только** с бэкенда next-films (или CI), не из браузера.

**Auth:** заголовок `Authorization: Bearer <PHOTO_PROCESSOR_TOKEN>` (общий секрет с Next).

Два режима тела (выбрать один для v1; оба можно поддержать):

#### Режим A — multipart (проще для старта)

`Content-Type: multipart/form-data`

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `file` | file | да | исходник ≤ 4 MiB |
| `kind` | string | да | `poster` \| `portrait` \| `frame` |
| `entityId` | string UUID | нет | если нет — сервис генерирует UUID |
| `movieId` | string UUID | для `frame` | иначе 400 |
| `jobId` | string | нет* | нужен для async webhook |
| `webhookUrl` | string URL | нет* | если задан — после успеха POST туда |

\* Для async: `jobId` + `webhookUrl` обязательны (или `webhookUrl` берётся из env `DEFAULT_WEBHOOK_URL`, а `jobId` всё равно обязателен).

#### Режим B — JSON + sourceUrl (удобнее, если Next уже положил raw в Blob)

```json
{
  "jobId": "01J…",
  "kind": "frame",
  "entityId": "0193…",
  "movieId": "0193…",
  "sourceUrl": "https://….blob.vercel-storage.com/tmp/…",
  "fileName": "shot.jpg",
  "contentType": "image/jpeg",
  "webhookUrl": "https://your-app.vercel.app/api/internal/photos/completed"
}
```

Сервис скачивает `sourceUrl` (нужен доступ: либо временный signed/public tmp, либо тот же `BLOB_READ_WRITE_TOKEN` для private read). После успеха tmp можно не чистить в v1 (чистит Next) или удалять опционально.

### Успешный sync-ответ `200`

```json
{
  "ok": true,
  "jobId": "01J…",
  "entityId": "0193…",
  "kind": "poster",
  "movieId": null,
  "url": "https://….private.blob.vercel-storage.com/posters/0193….avif",
  "blurhash": "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
  "width": 800,
  "height": 1200,
  "contentType": "image/avif",
  "bytes": 48210
}
```

Поля `width`/`height`/`bytes` — опциональны, но полезны для отладки. Минимум, который ждёт Next как сейчас: **`entityId`, `url`, `blurhash`**.

### Ошибки

| HTTP | Когда |
| --- | --- |
| `400` | плохой kind, нет movieId для frame, не картинка, > 4 MiB |
| `401` | нет/неверный Bearer |
| `413` | слишком большой body (если лимит раньше MAX_UPLOAD) |
| `422` | декод изображения не удался |
| `500` | сбой Blob / энкодера |
| `502/504` | (если Next проксирует) сеть до Cloud Run |

Тело ошибки:

```json
{ "ok": false, "error": "unsupported_image_type", "message": "…" }
```

Стабильные `error` code удобны для логов Next.

---

## Webhook → next-films (async)

После успешного `put` в Blob сервис делает:

`POST {webhookUrl}`  
`Authorization: Bearer <PHOTO_WEBHOOK_SECRET>`  
`Content-Type: application/json`  
`X-Job-Id: {jobId}`  
`X-Timestamp: {unix}`  
`X-Signature: hex(HMAC-SHA256(secret, timestamp + "." + rawBody))` — рекомендуется

Тело — тот же JSON, что sync `200` (`ok: true`, `jobId`, `entityId`, `kind`, `movieId`, `url`, `blurhash`, …).

### Поведение при сбое обработки

Если энкод/Blob упал и был `jobId` + webhook:

```json
{
  "ok": false,
  "jobId": "01J…",
  "entityId": "0193…",
  "kind": "frame",
  "error": "encode_failed",
  "message": "…"
}
```

Retry webhook: 3 попытки с backoff (например 1s / 3s / 10s). Идемпотентность на стороне Next по `jobId`.

### Что делает Next по webhook (не реализуется в Go-репо)

1. Проверяет секрет / HMAC.
2. Находит job / знает контекст по `jobId`.
3. Для poster/portrait — отдаёт админке или сохраняет url/blurhash в сущность.
4. Для frame — вызывает логику уровня `appendFrameGuessFrame(movieId, { id: entityId, url, blurhash })`.
5. Ставит job `DONE` / `FAILED`.

Эндпоинт в next-films (предложение имени):  
`POST /api/internal/photos/completed` — **ещё не обязан существовать**; контракт фиксируем здесь.

---

## Переменные окружения (Cloud Run)

| Env | Обязательно | Описание |
| --- | --- | --- |
| `PHOTO_PROCESSOR_TOKEN` | да | Bearer для входящих `/v1/process` |
| `BLOB_READ_WRITE_TOKEN` | да | тот же токен, что в next-films `.env` |
| `PHOTO_WEBHOOK_SECRET` | да для async | подпись/Bearer исходящего webhook |
| `DEFAULT_WEBHOOK_URL` | нет | fallback, если в запросе нет `webhookUrl` |
| `AVIF_QUALITY` | нет | default `38` |
| `AVIF_EFFORT` | нет | default `6` |
| `MAX_UPLOAD_BYTES` | нет | default `4194304` |
| `PORT` | Cloud Run задаёт | слушать `0.0.0.0:$PORT` |

Секреты — через Secret Manager / Cloud Run secrets, не в git.

---

## Требования к рантайму Cloud Run

- Контейнер слушает **`$PORT`** (обычно 8080).
- CPU: для AVIF `effort=6` лучше **CPU always allocated** или достаточный vCPU на время запроса (иначе энкод будет медленным).
- Timeout: 60–120 s на инстанс достаточно для одного кадра ≤ 4 MiB.
- Concurrency: начать с `1–4` на инстанс (AVIF CPU-bound); не ставить десятки.
- Memory: старт с **512 MiB–1 GiB**.
- Регион: ближе к Vercel Blob / вызовам из Vercel (часто `us-central1` / `europe-west1`), не «рядом с пользователем в блокируемой стране» — браузер Cloud Run не видит.
- Публичный ingress: либо allow unauthenticated + проверка Bearer в приложении, либо IAM + Next вызывает с identity token (сложнее). Для v1 достаточно **публичный URL + сильный Bearer**.

---

## Рекомендуемый стек Go (ориентир, не догма)

| Задача | Вариант |
| --- | --- |
| HTTP | `net/http` или chi/echo |
| Декод JPEG/PNG/WebP/GIF | `image` + сторонние декодеры; либо **libvips** через CGo / `bimg` |
| AVIF encode | libvips/`govips`, или libavif через CGo |
| Blurhash | чистый Go encoder (совместимый с [woltapp/blurhash](https://github.com/woltapp/blurhash)) |
| Blob upload | HTTP API Vercel Blob (`PUT` с токеном) — см. официальный REST; либо тонкая обёртка |
| UUID | Google UUID / gofrs; предпочтительно **UUIDv7** как в next-films |

Важно: бинарник с libvips/libaom собирайте в **Docker multi-stage** на `debian`/`ubuntu` с нужными `.so`, не на «чистом» scratch без либ.

Альтернатива без CGo: вызвать внешний `avifenc` в контейнере — тоже ок для Cloud Run, хуже по контролю API.

Пайплайн по шагам (эквивалент sharp):

1. Прочитать bytes, проверить размер.
2. Detect MIME.
3. Decode + apply EXIF orientation.
4. Resize: max width по `kind`, preserve aspect, no upscale.
5. Flatten / drop alpha → RGB.
6. Из RGBA (после ensure alpha для blurhash) посчитать blurhash с нужными component X/Y.
7. Encode AVIF q=38, effort=6, 4:2:0.
8. Upload pathname → получить `url`.
9. Ответить JSON и/или webhook.

---

## Контракт совместимости с админкой next-films

Сейчас админка ожидает от upload:

```ts
{ url: string; blurhash: string; entityId: string }
```

Go-сервис должен уметь вернуть как минимум эти три поля (+ `kind`/`movieId`/`jobId` для маршрутизации на Next).

Pathname и private access должны совпадать — иначе сломается `/api/media` и удаление через `deleteStoredPhoto`.

---

## Безопасность

1. Не принимать запросы без `PHOTO_PROCESSOR_TOKEN`.
2. Не светить Cloud Run URL в клиентском JS / Telegram WebApp.
3. Webhook принимать на Next только с секретом + (желательно) HMAC.
4. Ограничить размер body на стороне Go **и** Cloud Run.
5. Не логировать сырые байты изображений и токены Blob.
6. `sourceUrl` (режим B): allowlist хостов только вашего Blob origin (парсится из токена так же, как `blobStoreOrigin` в next-films).

---

## Порядок реализации (чеклист для Go-репо)

1. [ ] Dockerfile + `/healthz` на Cloud Run.
2. [ ] `POST /v1/process` multipart + Bearer.
3. [ ] Detect MIME + resize + AVIF + blurhash (сверить визуально/размером с текущим sharp).
4. [ ] Upload в Vercel Blob private по правилам pathname.
5. [ ] Sync JSON ответ.
6. [ ] Webhook + retries + failure payload.
7. [ ] Env/secrets, таймауты, concurrency.
8. [ ] Контрактный тест: один JPEG poster → url оканчивается на `.avif`, blurhash непустой, ширина ≤ 800.
9. [ ] В next-films (отдельно): internal webhook + замена вызова `storePhoto` на клиент Cloud Run.

---

## Вне скоупа этого сервиса

- Запись/чтение PostgreSQL, Prisma, миграции.
- Telegram initData / JWT админа.
- Раздача картинок игрокам (остаётся `/api/media`).
- Удаление Blob при удалении фильма/кадра (остаётся next-films `deleteStoredPhoto`).
- Очередь Pub/Sub (можно добавить позже; для v1 хватит HTTP + webhook).

---

## Пример запроса (sync multipart)

```bash
curl -sS -X POST "https://PHOTO_PROCESSOR_URL/v1/process" \
  -H "Authorization: Bearer $PHOTO_PROCESSOR_TOKEN" \
  -F "file=@poster.jpg;type=image/jpeg" \
  -F "kind=poster" \
  -F "entityId=0193aaaaaaaaaaaaaaaaaaaaaaaa"
```

Ожидаемый ответ: JSON с `ok`, `entityId`, `url`, `blurhash`.

## Пример webhook успеха

```http
POST /api/internal/photos/completed HTTP/1.1
Host: your-app.vercel.app
Authorization: Bearer <PHOTO_WEBHOOK_SECRET>
Content-Type: application/json

{
  "ok": true,
  "jobId": "job_01J…",
  "entityId": "0193…",
  "kind": "frame",
  "movieId": "0193…",
  "url": "https://….private.blob.vercel-storage.com/frame-guess/0193…/0193….avif",
  "blurhash": "LGF5]+Yk^6#M@-5c,1J5@[or[Q6.",
  "width": 1280,
  "height": 720,
  "contentType": "image/avif"
}
```

---

## Кратко для агента в Go-репо

Собрать HTTP-сервис для Cloud Run: один эндпоинт обработки фото под контракт выше, загрузка в **существующий private Vercel Blob**, уведомление next-films через sync JSON или signed webhook. **Postgres не трогать.** Параметры resize/AVIF/blurhash/pathnames держать как в таблице совместимости, чтобы админка и игры next-films продолжили работать без смены схемы БД.
