# Деплой KRUG на VPS

Все команды ниже выполняются пользователем `deploy`. Команды с `sudo` нужны только для настройки системного Nginx и certbot. Скрипты проекта не используют root и не удаляют volume базы данных.

## Первый запуск

1. В панели регистратора направьте A-записи `krugmc.ru` и `www.krugmc.ru` на `153.76.160.234`. До обновления DNS сертификат выпустить нельзя.

2. Клонируйте репозиторий и перейдите в него. Замените URL на фактический URL репозитория.

```bash
git clone <URL_РЕПОЗИТОРИЯ> /home/deploy/krugmc
cd /home/deploy/krugmc
```

3. Создайте файл окружения и укажите настоящие секреты.

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

Минимально замените `POSTGRES_PASSWORD`, `SESSION_SECRET`, `MC_HMAC_SECRET`, `INTERNAL_API_SECRET` и `TG_BOT_TOKEN`. Для production оставьте `APP_URL=https://krugmc.ru`, `NODE_ENV=production`, `DEV_MOCK_MC_LOGIN=false`, `MC_LOGIN_ENABLED=false`.

4. Установите конфигурацию Nginx. Каталог webroot нужен certbot для проверки домена.

```bash
sudo mkdir -p /var/www/certbot
sudo cp deploy/nginx/krugmc.ru.conf /etc/nginx/sites-available/krugmc.ru
sudo ln -s /etc/nginx/sites-available/krugmc.ru /etc/nginx/sites-enabled/krugmc.ru
sudo nginx -t
sudo systemctl reload nginx
```

Если включён стандартный сайт Nginx и он перехватывает запросы, отключите только его: `sudo unlink /etc/nginx/sites-enabled/default`, затем снова проверьте конфигурацию.

5. Соберите и запустите сервисы, затем примените миграции отдельной командой.

```bash
docker compose up -d --build
docker compose exec -T web node ../node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
```

6. Только после того как DNS указывает на `153.76.160.234`, выпустите сертификат.

```bash
sudo certbot --nginx -d krugmc.ru -d www.krugmc.ru
```

Certbot обычно сам добавляет HTTPS-блок. Если он этого не сделал, раскомментируйте HTTPS-блок в `/etc/nginx/sites-available/krugmc.ru`, выполните `sudo nginx -t` и `sudo systemctl reload nginx`.

## Обновление

```bash
cd /home/deploy/krugmc
chmod +x deploy/deploy.sh deploy/backup-db.sh
DEPLOY_BRANCH=main ./deploy/deploy.sh
```

Скрипт делает fast-forward pull, пересобирает сервисы, применяет миграции и ожидает healthcheck сайта. При ошибке он выводит последние логи. Volume `db_data` не удаляется.

## Резервные копии базы

Проверьте ручной запуск:

```bash
cd /home/deploy/krugmc
./deploy/backup-db.sh
```

Добавьте ежедневный запуск в crontab пользователя `deploy`:

```bash
crontab -e
```

```cron
15 3 * * * cd /home/deploy/krugmc && /home/deploy/krugmc/deploy/backup-db.sh >> /home/deploy/backups/backup.log 2>&1
```

Дампы создаются в `/home/deploy/backups/`; скрипт оставляет 14 последних файлов.

## Диагностика

```bash
cd /home/deploy/krugmc
docker compose config
docker compose ps
docker compose logs --tail=100 web bot db
curl -i http://127.0.0.1:3000/api/health
sudo nginx -t
```
