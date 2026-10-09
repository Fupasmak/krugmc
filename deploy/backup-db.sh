#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/deploy/krugmc}"
BACKUP_DIR="/home/deploy/backups"

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR"

timestamp="$(date +%Y%m%d_%H%M%S)"
backup_file="${BACKUP_DIR}/krugmc_${timestamp}.sql.gz"

# Берём имена из уже запущенного контейнера, поэтому скрипт не требует
# экспортировать переменные из .env в оболочку cron.
postgres_user="$(docker compose exec -T db printenv POSTGRES_USER)"
postgres_db="$(docker compose exec -T db printenv POSTGRES_DB)"
docker compose exec -T db pg_dump -U "$postgres_user" -d "$postgres_db" | gzip > "$backup_file"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'krugmc_*.sql.gz' -printf '%T@ %p\n' | sort -nr | tail -n +15 | cut -d' ' -f2- | xargs -r rm -f --
echo "Резервная копия создана: ${backup_file}"