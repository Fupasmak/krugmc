# KRUG — krugmc.ru

Сайт сервера Minecraft **KRUG**, Telegram-бот и Paper-плагин.
Слоган: «Создаём круг там, где квадрат».

```
krugmc/
├── web/        сайт: Next.js 15 (App Router) + TypeScript + Prisma
├── minecraft/  плагин Paper 26.2 (Java 25, Gradle Kotlin DSL)
├── TGBOT/      Telegram-бот: Node + grammY
├── docs/       nginx-конфиг, вспомогательные файлы деплоя
├── docker-compose.yml
└── .env.example
```

Документация: [`API.md`](API.md) — все эндпоинты и подпись HMAC,
[`DATA_SCHEMA.md`](DATA_SCHEMA.md) — таблицы БД,
[`docs/TESTING.md`](docs/TESTING.md) — сквозная проверка руками,
[`docs/STATUS.md`](docs/STATUS.md) — что готово, что осталось и что нужно от тебя.

---

## Что нужно на машине

| Инструмент | Версия | Зачем |
|---|---|---|
| Node.js | ≥ 22 (проверено на 24) | сайт и бот |
| npm | ≥ 10 | монорепо на npm workspaces |
| PostgreSQL | 16 | база |
| JDK | 25 | только для сборки плагина |
| Docker + Compose | любой свежий | только для деплоя на VDS |

---

## Запуск локально

### 1. Зависимости и переменные

```bash
npm install
cp .env.example .env
```

Заполни `.env`. Минимум для локального запуска:

```
DATABASE_URL=postgresql://krug:пароль@localhost:5432/krug?schema=public
SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SESSION_SECRET=<openssl rand -hex 32>
MC_HMAC_SECRET=<openssl rand -hex 32>
INTERNAL_API_SECRET=<openssl rand -hex 32>
TG_BOT_TOKEN=<токен от @BotFather>
```

Секреты генерируются так:

```bash
openssl rand -hex 32
```

Если `openssl` нет (Windows без Git Bash):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. База

Подними PostgreSQL любым способом. Самый быстрый — контейнер только с базой:

```bash
docker compose up -d db
```

Затем накати схему и наполни справочники:

```bash
npm run db:migrate
npm run db:seed
```

`db:seed` создаёт настройки сайта (статус проекта, ссылка на трейлер) и первую
неделю архива. Выдуманных игроков и завозов он не добавляет.

Первая миграция уже лежит в репозитории, поэтому на проде достаточно
`npm run db:deploy` — придумывать новую миграцию не нужно.

### 3. Сайт

```bash
npm run dev
```

Откроется `http://localhost:3000`.

### 4. Бот

В отдельном терминале:

```bash
npm run dev:bot
```

Бот стартует в режиме long polling и поднимает внутренний HTTP-порт
(`BOT_INTERNAL_PORT`, по умолчанию 8081) — через него сайт проверяет подписку
на канал.

### 5. Плагин

```bash
cd minecraft
./gradlew build
```

Готовый `minecraft/build/libs/krug-<версия>.jar` положи в `plugins/` сервера
Paper. Подробности и настройка `config.yml` — в [`minecraft/README.md`](minecraft/README.md).

---

## Проверка, что всё живо

```bash
curl http://localhost:3000/api/health
```

Ответ `{"ok":true,"db":true}` означает, что сайт поднялся и видит базу.

---

## Деплой на VDS

Нужны: домен `krugmc.ru` с A-записью на IP сервера, открытые порты 80 и 443.

### 1. Код и переменные

```bash
git clone <репозиторий> /opt/krugmc
cd /opt/krugmc
cp .env.example .env
nano .env
```

В продовом `.env` обязательно поменяй: `POSTGRES_PASSWORD`, `SESSION_SECRET`,
`MC_HMAC_SECRET`, `INTERNAL_API_SECRET`, `TG_BOT_TOKEN`, и выставь
`SITE_URL=https://krugmc.ru`, `NEXT_PUBLIC_SITE_URL=https://krugmc.ru`,
`BOT_INTERNAL_URL=http://bot:8081`.

### 2. Сертификат Let's Encrypt

Первый раз — до старта nginx с HTTPS-конфигом:

```bash
docker run --rm -p 80:80 \
  -v /opt/krugmc/docs/nginx/certs:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d krugmc.ru -d www.krugmc.ru \
  --agree-tos -m ваша@почта.ru --non-interactive
```

Продление (в cron раз в неделю):

```bash
docker run --rm -v /opt/krugmc/docs/nginx/certs:/etc/letsencrypt \
  -v krugmc_certbot_webroot:/var/www/certbot \
  certbot/certbot renew --webroot -w /var/www/certbot \
  && docker compose -f /opt/krugmc/docker-compose.yml exec nginx nginx -s reload
```

### 3. Запуск

```bash
docker compose up -d --build
docker compose exec web npx prisma migrate deploy
docker compose exec web npm run db:seed
```

### 4. Обновление

```bash
git pull
docker compose up -d --build
docker compose exec web npx prisma migrate deploy
```

---

## Telegram-бот: подготовка

1. @BotFather → `/newbot` (или используй существующего) → получи токен → в `.env`.
2. @BotFather → `/setdomain` → `krugmc.ru` (нужно для корректных deep-link).
3. Добавь бота **администратором** канала `@serverKRUG`. Без прав администратора
   `getChatMember` не отдаст статус подписчиков и голосование работать не будет.
4. Подробности — [`TGBOT/README.md`](TGBOT/README.md).

> Если токен бота где-то засветился (чат, скриншот, коммит) — немедленно
> @BotFather → `/revoke` → новый токен в `.env`. Старый после этого мёртв.

---

## Локальный запуск входа через Telegram

Вход через Telegram работает и на `localhost`, туннель (ngrok, cloudflared)
нужен только если переключаешь бота на webhook. В режиме long polling бот сам
ходит к Telegram, а сайт он дёргает по внутреннему адресу.

Что должно совпадать:

| Переменная | Локально | Почему это важно |
|---|---|---|
| `SITE_INTERNAL_URL` | `http://127.0.0.1:3000` | бот подтверждает токен на том же сайте, который открыт в браузере. Если тут стоит `https://krugmc.ru`, подтверждение уедет на прод, а локальная вкладка будет ждать вечно |
| `DATABASE_URL` | одна и та же строка у сайта и бота | они смотрят в одну базу, иначе токен «не находится» |
| `INTERNAL_API_SECRET` | одинаковый у сайта и бота | при расхождении сайт ответит `bad_signature` |
| `BOT_MODE` | `polling` | webhook на localhost Telegram не достучится |
| `NODE_ENV` | `development` | включает подробные логи входа |

Отдельный тестовый бот для разработки лучше, чем боевой: у одного токена может
быть только один активный `getUpdates`. Если боевой бот крутится на сервере, а
ты запустишь второй с тем же токеном, в логах появится
`Conflict: terminated by other getUpdates request`, и часть нажатий уйдёт не
туда. Заведи второго бота у @BotFather и пропиши его токен в локальный `.env`.

Если раньше бот работал по webhook, сбрось его: при старте в режиме polling
бот сам делает `deleteWebhook`, а в логе печатает предупреждение, если webhook
всё же остался.

Что писать в логи при разборе (только в development):

```
[login] выдан токен для Telegram { token: '32a04124...', length: 48, purpose: 'LOGIN', browser: '7201cb93', createdUtc: ..., expiresUtc: ... }
[bot]   пришла команда /start { from: 123, payloadLength: 54, payload: 'login_32a04124...' }
[bot]   запрос подтверждения { url: 'http://127.0.0.1:3000/api/internal/tg/confirm', status: 200 }
[tg-confirm] пришёл токен от бота { found: true, status: 'PENDING', expiresUtc: ..., nowUtc: ... }
[login] состояние входа { code: null, token: { status: 'CONFIRMED' } }
```

Все времена печатаются в UTC: и база, и сравнение внутри кода работают в UTC,
поэтому разница часовых поясов (Саратов это UTC+4) на срок жизни токена
не влияет.

Проверить весь путь без живого бота можно так: получить ссылку через
`POST /api/auth/tg/start`, взять из неё токен и отправить его в
`POST /api/internal/tg/confirm` с подписью HMAC (пример подписи есть в
[`API.md`](API.md)).

## Вход через Minecraft

Вход через сервер всегда включён. Сайт создаёт одноразовый код через
`POST /api/auth/mc/code`, а игрок вводит его командой `/krug login КОД`.
Плагин отправляет подписанный HMAC-запрос в `POST /api/plugin/mc-login`.
Страница опрашивает `GET /api/auth/mc/status` раз в две секунды и после
подтверждения вызывает `POST /api/auth/finish` для создания сессии.

Тестовые записи прошлых версий не удаляются автоматически. Их можно
просмотреть вручную:

```bash
npx dotenv -e .env -- npx prisma db execute --stdin <<< 'SELECT id, "mcNickname" FROM "User" WHERE "isTest" = true;'
```
## Карточки игроков

PNG-карточки лежат в `web/public/cards/`, имя файла — ник в нижнем регистре:
`fupasmak.png`. Требования к файлам — [`web/public/cards/README.md`](web/public/cards/README.md).
Заливать можно и через админку (`/admin` → Игроки), вручную класть файлы тоже можно.

---

## Пиксельные ассеты

Текстуры блоков, заглушки карточек, favicon и картинка для Open Graph
нарисованы кодом — оригинальные файлы Mojang не используются. Перерисовать:

```bash
node web/scripts/generate-assets.mjs
```

Палитру и набор блоков можно править прямо в этом скрипте.

## Полезные команды

| Команда | Что делает |
|---|---|
| `npm run dev` | сайт в режиме разработки |
| `npm run dev:bot` | бот в режиме разработки |
| `npm run build` | продовая сборка сайта и бота |
| `npm run db:migrate` | создать и применить миграцию (разработка) |
| `npm run db:deploy` | применить миграции (прод) |
| `npm run db:seed` | начальные данные |
| `npm run db:studio` | Prisma Studio — смотреть базу в браузере |
| `npm run lint` | ESLint |
| `npm run typecheck` | проверка типов сайта и бота |

---

## Правовое

Сайт не связан с Mojang Studios и Microsoft. Оригинальные текстуры и шрифт
Minecraft в проекте не используются: все пиксельные текстуры и иконки
нарисованы для этого сайта. Шрифт `web/public/fonts/minecraft-rus.ttf` —
сторонний шрифт, предоставленный владельцем проекта.
