/**
 * Общие типы настроек сайта: этот файл импортируют и сервер, и браузер,
 * поэтому обращений к базе здесь нет.
 */

export const PROJECT_STATUSES = {
  RECRUITING: 'Идёт набор',
  DEVELOPMENT: 'Идёт разработка',
  SEASON: 'Сезон идёт',
  PAUSED: 'Пауза',
  CLOSED: 'Набор закрыт',
} as const;

export type ProjectStatusKey = keyof typeof PROJECT_STATUSES;

export type SiteSettings = {
  projectStatus: ProjectStatusKey;
  projectStatusNote: string;
  trailerUrl: string;
  trailerTitle: string;
  heroTagline: string;
  joinOpen: boolean;
  mapUrl: string;
  mapEnabled: boolean;
  /** Адрес подключения к серверу. Виден только в админке, на страницы не выводится. */
  serverAddress: string;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  projectStatus: 'DEVELOPMENT',
  projectStatusNote: 'Готовим Zero Season. Набор скоро.',
  trailerUrl: '',
  trailerTitle: 'Трейлер KRUG',
  heroTagline: 'Создаём круг там, где квадрат',
  joinOpen: false,
  mapUrl: '',
  mapEnabled: false,
  serverAddress: '',
};
