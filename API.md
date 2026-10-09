# API KRUG

Все ответы — JSON. Успех: `{"ok": true, ...}`. Ошибка:

```json
{ "ok": false, "error": "code_expired", "message": "Код истёк, запроси новый на сайте" }
```

`message` написан по-русски и годится для показа пользователю, `error` —
машинный код.

Разделы:

- [Подпись внутренних запросов (HMAC)](#подпись-внутренних-запросов-hmac)
- [Вход](#вход)
- [Внутренние: плагин → сайт](#внутренние-плагин--сайт)
- [Внутренние: бот → сайт](#внутренние-бот--сайт)
- [Внутренние: сайт → бот](#внутренние-сайт--бот)
- [Завозы](#завозы)
- [Голосование и подписка](#голосование-и-подписка)
- [Головы скинов и вложения](#головы-скинов-и-вложения)
- [Админские эндпоинты](#админские-эндпоинты)
- [Ограничения частоты](#ограничения-частоты)

---

## Подпись внутренних запросов (HMAC)

Плагин и бот ходят на сайт (и сайт ходит на бота) с подписью.

Подписывается строка:

```
<timestamp>.<nonce>.<тело запроса ровно как оно отправлено>
```

Алгоритм — HMAC-SHA256, результат в нижнем регистре hex.

| Заголовок | Значение |
|---|---|
| `X-KRUG-Timestamp` | unix-время в секундах |
| `X-KRUG-Nonce` | случайные 16 байт в hex, один раз на запрос |
| `X-KRUG-Signature` | подпись |

Правила проверки:

- расхождение времени больше **60 секунд** — отказ `timestamp_out_of_window`;
- повтор `nonce` — отказ `nonce_reused` (защита от повторной отправки);
- несовпадение подписи — `bad_signature`.

Секреты: `MC_HMAC_SECRET` для плагина, `INTERNAL_API_SECRET` для бота.

Пример на Node:

```js
const crypto = require('node:crypto');

const body = JSON.stringify({ code: 'ABC123', uuid: '...', nickname: 'Fupasmak' });
const timestamp = Math.floor(Date.now() / 1000).toString();
const nonce = crypto.randomBytes(16).toString('hex');
const signature = crypto
  .createHmac('sha256', process.env.MC_HMAC_SECRET)
  .update(`${timestamp}.${nonce}.${body}`)
  .digest('hex');
```

Пример на Java — `minecraft/src/main/java/ru/krugmc/plugin/SiteApi.java`.

---

## Вход

Изменяющие запросы требуют CSRF-заголовок `X-CSRF-Token`, равный значению
cookie `krug_csrf` (её ставит middleware всем посетителям).

### `POST /api/auth/mc/code`

Выдаёт одноразовый код для входа через Minecraft.

```json
{
  "ok": true,
  "code": "K7H2XP",
  "expiresAt": "2026-09-17T12:34:56.000Z",
  "ttlSeconds": 300,
  "command": "/krug login K7H2XP"
}
```

Код живёт 5 минут, привязан к cookie `krug_browser`, попыток подтверждения — 5.

### `POST /api/auth/tg/start`

Выдаёт deep-link на бота. Если вызывает вошедший игрок — ссылка на привязку.

```json
{
  "ok": true,
  "purpose": "LOGIN",
  "deepLink": "https://t.me/KRUGSERVER_BOT?start=login_9f2c...",
  "expiresAt": "2026-09-17T12:40:00.000Z",
  "ttlSeconds": 600
}
```

### `GET /api/auth/stream`

Поток событий (SSE) о состоянии входа для текущего браузера.

События: `pending`, `confirmed`, `expired`, `timeout`, `error`.

```
event: confirmed
data: {"source":"mc","purpose":"LOGIN"}
```

### `GET /api/auth/status`

То же самое опросом, если SSE не работает.

```json
{ "ok": true, "state": "pending", "source": "mc", "purpose": null, "expiresAt": "..." }
```

`state`: `none` | `pending` | `confirmed` | `expired`.

### `POST /api/auth/finish`

Забирает подтверждённый вход и создаёт сессию (ставит cookie `krug_session`).

```json
{ "ok": true, "purpose": "LOGIN", "redirect": "/me", "user": { "type": "MC", "nickname": "Fupasmak" } }
```

### `POST /api/auth/logout` · `POST /api/auth/logout-all`

Гасит текущую сессию или все сессии аккаунта.

### `POST /api/me/unlink`

Отвязывает Telegram от аккаунта игрока.

---

## Внутренние: плагин → сайт

### `POST /api/plugin/mc-login`

Подписан `MC_HMAC_SECRET`. Тело:

```json
{
  "code": "K7H2XP",
  "uuid": "07e0d0c2-1a5b-4f1e-9a11-9f0d1a2b3c4d",
  "nickname": "Fupasmak",
  "textures": "eyJ0aW1lc3RhbXAiOi4uLn0="
}
```

`textures` — свойство профиля игрока, из него сайт вырезает голову скина.
Поле необязательное: без него сайт попробует взять профиль у Mojang по UUID.

Успех:

```json
{
  "ok": true,
  "message": "Вход подтверждён, возвращайся на сайт",
  "nickname": "Fupasmak",
  "profileUrl": "https://krugmc.ru/players/fupasmak"
}
```

Ошибки: `code_not_found` (404), `code_expired` (410), `too_many_attempts` (429),
`bad_signature` (401), `nickname_taken` (400).

Аккаунт ищется сначала по UUID, потом по нику в нижнем регистре: игрок,
заранее добавленный админом, подхватывается вместе с карточкой, дубля не
появляется.

---

## Внутренние: бот → сайт

Оба подписаны `INTERNAL_API_SECRET`.

### `POST /api/internal/tg/confirm`

```json
{
  "token": "9f2c...",
  "tgId": "123456789",
  "username": "oak",
  "firstName": "Серёга"
}
```

Успех: `{ "ok": true, "purpose": "LOGIN" | "LINK", "message": "...", "nickname": "Fupasmak" }`

Ошибки: `token_not_found` (404), `token_expired` (410), `tg_already_linked` (400).

### `POST /api/internal/tg/avatar`

Аватар зрителя байтами (прямые ссылки Telegram содержат токен бота, поэтому
их не храним).

```json
{ "tgId": "123456789", "mime": "image/jpeg", "data": "<base64, до 512 КБ>" }
```

---

## Внутренние: сайт → бот

### `POST http://bot:8081/internal/subscription`

Подписан `INTERNAL_API_SECRET`.

```json
{ "tgId": "123456789" }
```

Ответ: `{ "ok": true, "subscribed": true }`

Бот отвечает на основе `getChatMember` канала `TG_CHANNEL`. Подписанными
считаются статусы `creator`, `administrator`, `member`, а также `restricted`
с `is_member: true`.

### `GET http://bot:8081/health`

`{ "ok": true }`, без подписи.

---

## Завозы

### `GET /api/posts`

Параметры: `tag` (`STREAM` | `OFFSTREAM`), `cursor`, `limit` (до 30), `author` (ник).

```json
{
  "ok": true,
  "posts": [
    {
      "id": "clx...",
      "title": "Мост через каньон",
      "body": "текст в Markdown",
      "tag": "STREAM",
      "upCount": 12,
      "downCount": 1,
      "score": 11,
      "myVote": 1,
      "createdAt": "2026-09-16T20:10:00.000Z",
      "editedAt": null,
      "author": { "nickname": "Fupasmak", "slug": "fupasmak", "uuid": "..." },
      "attachments": [
        { "id": "cly...", "kind": "IMAGE", "url": "/uploads/2026/09/ab12.png", "mime": "image/png", "width": 1920, "height": 1080 }
      ]
    }
  ],
  "nextCursor": "clz..."
}
```

### `POST /api/posts`

Только игроки (вход через Minecraft). `multipart/form-data`:

| Поле | Что |
|---|---|
| `title` | 3–120 символов |
| `body` | 1–8000 символов, Markdown |
| `tag` | `STREAM` или `OFFSTREAM` |
| файлы | до 4 штук: png/jpg/webp/gif до 5 МБ, mp4/webm/mov до 200 МБ |

Тип файла определяется по сигнатуре, заголовку `Content-Type` от клиента
сайт не верит.

Ответ: `{ "ok": true, "id": "clx...", "redirect": "/posts/clx..." }`

### `GET /api/posts/<id>` · `PATCH /api/posts/<id>` · `DELETE /api/posts/<id>`

`PATCH` — правка своего завоза (или любого, если админ), тело
`{ "title": "...", "body": "...", "tag": "STREAM" }`. После правки в карточке
появляется пометка «изменено».

`DELETE` — мягкое удаление: завоз пропадает из ленты, админ может вернуть.

---

## Голосование и подписка

### `POST /api/posts/<id>/vote`

Тело: `{ "value": 1 }` или `{ "value": -1 }`.

Условия:

1. вход через Telegram (игроки сервера не голосуют) — иначе `forbidden`;
2. подписка на канал — иначе `forbidden` с текстом про подписку;
3. не свой завоз — иначе `forbidden`;
4. голос ещё не отдан — иначе `already_voted`.

Успех: `{ "ok": true, "upCount": 13, "downCount": 1, "score": 12, "myVote": 1 }`

Голос неизменяемый: в базе стоит уникальный индекс `(postId, userId)`,
счётчики обновляются в той же транзакции.

### `GET /api/subscription` · `POST /api/subscription`

`GET` — статус из кэша (живёт `SUBSCRIPTION_CACHE_TTL` секунд).
`POST` — «Я подписался, проверить»: спрашивает бота заново.

```json
{ "ok": true, "linked": true, "subscribed": false, "botAvailable": true, "channel": "@serverKRUG" }
```

---

## Головы скинов и вложения

### `GET /api/head/<ник или uuid>.png?size=64`

Голова скина: лицо 8×8 плюс второй слой, увеличенная без сглаживания.
Допустимые размеры: 16, 32, 48, 64, 96, 128, 256. Если скина нет — отдаётся
нарисованная нами голова по умолчанию. Поддерживается `ETag`.

### `GET /uploads/<путь>`

Вложения. В проде их отдаёт nginx, роут в приложении — запасной путь для
разработки. Поддерживается `Range` (перемотка видео).

---

## Админские эндпоинты

Все требуют роль `ADMIN` или `SUPERADMIN` и CSRF-заголовок.

| Метод и адрес | Что делает |
|---|---|
| `GET /api/admin/players` | список игроков, включая скрытых и не заходивших |
| `POST /api/admin/players` | добавить игрока по нику заранее |
| `PATCH /api/admin/players/<id>` | скрыть, изменить текст, выдать роль (роль — только `SUPERADMIN`) |
| `DELETE /api/admin/players/<id>` | удалить запись, если игрок не заходил и без завозов |
| `POST /api/admin/players/<id>/card` | загрузить карточку (multipart, приводится к 800×1200) |
| `DELETE /api/admin/players/<id>/card` | убрать карточку |
| `PATCH /api/admin/posts/<id>` | закрепить/открепить, вернуть удалённый |
| `GET/POST /api/admin/archive/weeks` | недели архива |
| `PATCH/DELETE /api/admin/archive/weeks/<id>` | правка и удаление недели |
| `POST /api/admin/archive/items` | запись в неделю (JSON или multipart с файлом) |
| `PATCH/DELETE /api/admin/archive/items/<id>` | правка и удаление записи |
| `GET/POST /api/admin/media` · `DELETE /api/admin/media/<id>` | видео проекта |
| `GET/POST /api/admin/wiki` · `PATCH/DELETE /api/admin/wiki/<id>` | статьи вики |
| `GET/PATCH /api/admin/settings` | статус проекта, трейлер, слоган, набор |
| `GET/PUT/DELETE /api/admin/content/<slug>` | тексты страниц: `about`, `zero`, `join`, `corner` |

`DELETE` у текстов возвращает страницу к файлу из `web/content`.

### `GET /api/health`

`{ "ok": true, "db": true }` — жив ли сайт и видит ли он базу.

---

## Ограничения частоты

Счётчики лежат в базе, поэтому лимит общий для всех воркеров.

| Действие | Лимит |
|---|---|
| Запрос кода входа | 10 в час на IP |
| Подтверждение входа | 20 в час на IP, 5 попыток на код |
| Голос | 30 в час на пользователя |
| Новый завоз | 5 в час на автора |
| Правка завоза | 20 в час |
| Загрузка файлов | 30 в час |
| Проверка подписки вручную | 20 за 10 минут |

Превышение — ответ 429 с человеческим текстом и временем ожидания.
