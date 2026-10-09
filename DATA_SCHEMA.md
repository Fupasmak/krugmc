# Схема данных KRUG

PostgreSQL 16, Prisma. Исходник — [`web/prisma/schema.prisma`](web/prisma/schema.prisma),
первая миграция — `web/prisma/migrations/20260917000000_init/migration.sql`.

Имена таблиц и полей английские, даты — `timestamptz`.

---

## User — пользователи

Одна таблица на два типа входа: игроки (`MC`) и зрители (`TG`).

| Поле | Тип | Смысл |
|---|---|---|
| `id` | cuid | первичный ключ |
| `type` | `MC` \| `TG` | как человек вошёл |
| `role` | `USER` \| `ADMIN` \| `SUPERADMIN` | права. `SUPERADMIN` выдаётся автоматически нику из `SUPERADMIN_NICKNAME` |
| `mcUuid` | text? unique | UUID игрока Minecraft |
| `mcNickname` | text? | ник как есть |
| `mcNicknameLower` | text? unique | ник в нижнем регистре: по нему идёт поиск, карточки и защита от дублей |
| `tgId` | bigint? unique | id в Telegram |
| `tgUsername`, `tgFirstName`, `tgPhotoUrl` | text? | данные из Telegram, аватар лежит в `uploads/avatars` |
| `cardFile` | text? | имя PNG-карточки в `web/public/cards` |
| `wikiText` | text? | текст об игроке на его странице (Markdown), правит админ |
| `hidden` | bool | скрыт из списка игроков |
| `firstLoginAt` | ts? | `null` — игрока добавил админ, сам он ещё не заходил |
| `lastLoginAt` | ts? | последний вход |
| `createdById` | cuid? | кто добавил запись вручную |

Индексы: `(type, hidden)`, `firstLoginAt`.

**Почему одна таблица.** Игрок и зритель различаются только способом входа и
правами; отдельные таблицы заставили бы дублировать сессии, голоса и аудит.

## Skin — головы скинов

| Поле | Тип | Смысл |
|---|---|---|
| `userId` | cuid pk | игрок |
| `texturesValue` | text? | свойство `textures` из профиля |
| `skinUrl` | text? | адрес скина на `textures.minecraft.net` |
| `headPng` | bytes | готовая голова 64×64 (лицо + второй слой) |
| `isSlim` | bool | тонкая модель рук |
| `updatedAt` | ts | обновляется при каждом входе через Minecraft |

Голова хранится уже вырезанной: отдача `/api/head/...` — это только масштаб.

## Session — сессии

| Поле | Смысл |
|---|---|
| `tokenHash` | SHA-256 от токена; сам токен только в cookie |
| `userAgent`, `ip` | для «выйти на всех устройствах» |
| `expiresAt` | 30 дней |
| `revokedAt` | заполняется при выходе |

## LoginCode — коды входа из игры

| Поле | Смысл |
|---|---|
| `code` unique | шесть символов без похожих друг на друга букв |
| `browserToken` unique | cookie браузера, который запросил вход |
| `status` | `PENDING` → `CONFIRMED` → `USED`, либо `EXPIRED` |
| `attempts` | не больше 5 |
| `userId` | заполняется плагином при подтверждении |
| `expiresAt` | 5 минут |

## TgLoginToken — ссылки для бота

| Поле | Смысл |
|---|---|
| `token` unique | попадает в `?start=login_<token>` |
| `purpose` | `LOGIN` (вход зрителя) или `LINK` (привязка к игроку) |
| `browserToken` | та же привязка к вкладке |
| `targetUserId` | для `LINK` — чей аккаунт |
| `resultUserId` | кто получился после подтверждения |
| `expiresAt` | 10 минут |

## UsedNonce — защита от повторов

`nonce` (pk), `scope` (`mc` / `bot`), `createdAt`. Живёт пару минут, чистится
попутно при обращениях.

## Post — завозы

| Поле | Смысл |
|---|---|
| `authorId` | игрок-автор |
| `title` | до 120 символов |
| `body` | Markdown, до 8000 символов |
| `tag` | `STREAM` (на стриме) или `OFFSTREAM` (вне стрима) |
| `pinned` | закреплён админом |
| `upCount`, `downCount`, `score` | счётчики, меняются в транзакции вместе с голосом |
| `editedAt` | `null` — не правился; иначе под карточкой подпись «изменено» |
| `deletedAt` | мягкое удаление: из ленты пропал, админ может вернуть |

Индексы: `createdAt`, `(deletedAt, createdAt)`, `(tag, createdAt)`,
`(authorId, createdAt)`, `score`.

## PostAttachment — вложения

`kind` (`IMAGE` / `VIDEO`), `path` (относительно `UPLOAD_DIR`), `mime`, `size`,
`width`, `height`, `order`. До четырёх на завоз.

## Vote — голоса

| Поле | Смысл |
|---|---|
| `postId`, `userId` | **уникальная пара** — один голос на человека за завоз |
| `value` | `1` или `-1`, изменению не подлежит |

Правило «голосуют только зрители с подпиской» проверяется на сервере перед
записью; уникальный индекс — второй рубеж, чтобы двойной клик или гонка
запросов не создали второй голос.

## SubscriptionCache — кэш подписки

`tgId` (pk), `subscribed`, `checkedAt`. Срок жизни задаётся
`SUBSCRIPTION_CACHE_TTL` (по умолчанию 10 минут), чтобы не дёргать Telegram
на каждый голос.

## ArchiveWeek и ArchiveItem — архив

`ArchiveWeek`: `number` unique, `title`, `summary`, `coverPath`, `startsAt`,
`endsAt`, `published` (черновик виден только админам).

`ArchiveItem`: `weekId`, `kind` (`BUILD`, `ART`, `VIDEO`, `POST`, `LIFE`),
`title`, `description`, `path` (файл) или `url` (YouTube/VK), `authorId`,
`postId` (если запись сделана из завоза), `order`.

## WikiArticle — вики

`slug` unique, `title`, `category`, `body` (Markdown), `published`,
`updatedById`, `updatedAt`. Правят только админы, истории правок нет.

## MediaItem — видео проекта

`title`, `url`, `thumbnail`, `description`, `authorId`, `weekId`, `publishedAt`.

## TeamMember — команда

`nickname` unique, `role`, `about`, `cardFile`, `links` (json), `order`,
`visible`. Раздел закрыт флагом `FEATURE_TEAM`, интерфейса управления пока нет —
записи добавляются в базе.

## SiteSetting — настройки и тексты

`key` (pk), `value` (json). Используются ключи:

- `site` — статус проекта, ссылка на трейлер, слоган, открыт ли набор;
- `content:about`, `content:zero`, `content:join`, `content:corner` — тексты
  страниц, перекрывающие файлы из `web/content`.

## AuditLog — что делали админы

`actorId`, `action` (например `player.card.upload`), `target`, `meta`, `ip`,
`createdAt`. Показывается на главной странице админки.

## RateLimit — счётчики частоты

`key` (например `vote:<userId>`), `count`, `windowStart`. В базе, а не в
памяти процесса: иначе при нескольких воркерах лимит обходится.

---

## Связи

```
User 1—1 Skin
User 1—* Session
User 1—* Post —* PostAttachment
User 1—* Vote *—1 Post        (уникально: postId + userId)
ArchiveWeek 1—* ArchiveItem *—1 User
ArchiveWeek 1—* MediaItem
User 1—* WikiArticle (как редактор)
User 1—* AuditLog
```

## Что происходит при удалении

- удаление `User` уносит его сессии, скин, завозы и голоса (`ON DELETE CASCADE`);
- удаление `Post` уносит вложения и голоса;
- удаление `ArchiveWeek` уносит записи недели (файлы с диска удаляет код);
- у `ArchiveItem`, `MediaItem`, `WikiArticle` ссылка на автора обнуляется
  (`ON DELETE SET NULL`), сама запись остаётся.

Игрока, который уже заходил или писал завозы, интерфейс удалить не даст —
только скрыть.
