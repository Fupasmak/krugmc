-- Привязка личного Telegram к аккаунту игрока убрана из интерфейса.
-- Поля оставляем ради зрителей, у игроков значения чистим.
UPDATE "User"
SET "tgId" = NULL,
    "tgUsername" = NULL,
    "tgFirstName" = NULL,
    "tgPhotoUrl" = NULL
WHERE "type" = 'MC';
