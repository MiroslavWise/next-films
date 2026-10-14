export const copy = {
  appTitle: "Кино-выбор",
  appDescription: "Мини-приложение Telegram: три фильма и три решения.",
  homeLead: "Выберите игру",
  play: "Играть",
  soon: "Скоро",
  openInTelegram: "Откройте приложение в Telegram",
  invalidInitData: "Недействительные данные Telegram",
  expiredInitData: "Сессия Telegram устарела. Откройте приложение заново.",
  rateLimited: "Слишком частые действия. Попробуйте чуть позже.",
  notFound: "Не найдено",
  forbidden: "Недостаточно прав",
  internal: "Внутренняя ошибка. Попробуйте ещё раз.",
  validation: "Проверьте введённые данные",
  confirm: "Подтвердить",
  loading: "Загрузка",
  sending: "Сохраняем выбор",
  saved: "Выбор сохранён",
  retry: "Повторить",
  duplicateChoice: "Один вариант можно выбрать только для одного фильма",
  emptyTitle: "Недостаточно фильмов",
  emptyText: "В каталоге нужно хотя бы три фильма, чтобы начать раунд.",
  playoffEmptyText: "В каталоге нужно хотя бы 32 фильма, чтобы начать плей-офф.",
  playoffTitle: "Кино-плей-офф",
  playoffPick: "Выберите фильм",
  playoffNewGame: "Новая игра",
  playoffPlayNew: "Сыграть новую",
  playoffHistoryEmpty: "Пока нет сыгранных турниров",
  playoffBackToList: "К списку",
  playoffFinish: "Завершить",
  playoffFinalist: "Финалист",
  playoffConflict: "Состояние обновилось. Обновляем…",
  frameGuessTitle: "Угадай кадр",
  frameGuessPick: "Какой это фильм?",
  frameGuessCorrect: "Верно",
  frameGuessWrong: "Неверно",
  frameGuessScore: "Счёт",
  frameGuessNewGame: "Новая игра",
  frameGuessPlayNew: "Сыграть новую",
  frameGuessFinish: "Завершить",
  frameGuessHistoryEmpty: "Пока нет сыгранных партий",
  frameGuessBackToList: "К списку",
  frameGuessEmptyText: "Нужны кадры хотя бы у одного фильма и минимум 4 фильма в каталоге.",
  frameGuessAnswered: "Ответов",
  frameRevealTitle: "Прояви кадр",
  frameRevealPick: "Какой это фильм?",
  frameRevealMore: "Открыть ещё",
  frameRevealCorrect: "Верно",
  frameRevealWrong: "Неверно",
  frameRevealScore: "Счёт",
  frameRevealPlayNew: "Сыграть новую",
  frameRevealFinish: "Завершить",
  frameRevealHistoryEmpty: "Пока нет сыгранных партий",
  frameRevealBackToList: "К списку",
  frameRevealEmptyText: "Нужны кадры хотя бы у одного фильма и минимум 4 фильма в каталоге.",
  frameRevealOpened: "Открыто",
  backHome: "На главную",
  choices: {
    WATCH_MANY: "Смотреть много раз",
    WATCH_ONCE: "Хватит одного",
    REMOVE: "Убрать из киноиндустрии",
  },
  choicesShort: {
    WATCH_MANY: "Много",
    WATCH_ONCE: "Один",
    REMOVE: "Убрать",
  },
  sessionExpired: "Сессия истекла. Обновляем доступ…",
  unauthorized: "Нужна авторизация",
  admin: {
    title: "Админка",
    open: "Админка",
    movies: "Фильмы",
    movieAdd: "Добавить фильм",
    movieEdit: "Изменить фильм",
    frames: "Кадры",
    framesTitle: "Кадры для «Угадай кадр»",
    framesHint: "Загрузите кадры из фильма. Каждый файл сохранится как AVIF с blurhash.",
    framesEmpty: "Пока нет кадров",
    framesAdd: "Добавить кадры",
    framesActive: "Участвует в игре",
    framesUploading: "Загрузка…",
    frameDeleted: "Кадр удалён",
    frameAdded: "Кадр добавлен",
    framesAdded: "Кадры добавлены",
    frameDeleteTitle: "Удалить кадр?",
    frameDeleteMessage: "Кадр будет удалён из игры и из хранилища.",
    actors: "Актёры",
    actorAdd: "Добавить актёра",
    actorEdit: "Изменить актёра",
    directors: "Режиссёры",
    producers: "Продюсеры",
    genres: "Жанры",
    genreAdd: "Добавить жанр",
    genreEdit: "Изменить жанр",
    users: "Пользователи",
    usersHint: "Кто открывал Mini App",
    usersEmpty: "Пока никто не заходил",

    add: "Добавить",
    save: "Сохранить",
    delete: "Удалить",
    edit: "Изменить",
    cancel: "Отмена",
    name: "Имя",
    titleField: "Название",
    photo: "Фото",
    poster: "Постер",
    required: "Обязательное поле",
    optional: "Необязательно",
    noAccess: "Эта страница доступна только администраторам.",
    saved: "Сохранено",
    deleted: "Удалено",
    usedElsewhere: "Сначала уберите связи с фильмами.",
    duplicate: "Такая запись уже есть.",
    photoTooLarge: "Файл больше 4 МБ.",
    photoType: "Нужен файл изображения.",
    posterRequired: "Добавьте постер",
    emptyList: "Пока пусто",
    replacePhoto: "Заменить фото",
    chooseFile: "Нажмите, чтобы выбрать файл",
    prevPage: "Назад",
    nextPage: "Далее",
    pageOf: "Стр.",
  },
} as const

export const ROUND_SIZE = 3
export const PLAYOFF_SIZE = 32
export const ADMIN_MOVIES_PAGE_SIZE = 20
export const ADMIN_ACTORS_PAGE_SIZE = 50
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
/** Для мини-приложения хватает ~800px по ширине; сильнее режет вес. */
export const POSTER_MAX_WIDTH = 800
export const PORTRAIT_MAX_WIDTH = 640
/** Кадры чаще landscape — шире постеров. */
export const FRAME_MAX_WIDTH = 1280
/** 1–100; ниже = меньше файл. 38 даёт заметное сжатие без сильной мыльности на постерах. */
export const AVIF_QUALITY = 38
/** 0–9; выше = сильнее сжатие, дольше CPU. */
export const AVIF_EFFORT = 6
export const INIT_DATA_MAX_AGE_SECONDS = 60 * 60 * 24
export const JWT_TTL_SECONDS = 60 * 60 * 12
// Библиотека blurhash принимает только 1..9 компонент по каждой оси.
// 5×9 близко к пропорции постера 9:16.
export const BLURHASH_X = 5
export const BLURHASH_Y = 9
/** Компоненты blurhash для landscape-кадров (~16:9). */
export const FRAME_BLURHASH_X = 9
export const FRAME_BLURHASH_Y = 5
/** Разрешение canvas превью blurhash (react-blurhash), не путать с компонентами encode. */
export const BLURHASH_PREVIEW_PORTRAIT = { x: 32, y: 56 } as const
export const BLURHASH_PREVIEW_LANDSCAPE = { x: 56, y: 32 } as const
