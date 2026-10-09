#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/deploy/krugmc}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

on_error() {
  code=$?
  echo "Деплой завершился с ошибкой (код ${code}). Последние логи контейнеров:"
  docker compose logs --tail=100 || true
  exit "$code"
}
trap on_error ERR

cd "$PROJECT_DIR"
git pull --ff-only origin "$DEPLOY_BRANCH"
docker compose build
docker compose up -d

# Миграции запускаются только этим явным шагом, а не при старте контейнера.
docker compose exec -T web node ../node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma

for attempt in {1..12}; do
  status="$(docker inspect --format='{{.State.Health.Status}}' "$(docker compose ps -q web)")"
  echo "web healthcheck: ${status}"
  [ "$status" = "healthy" ] && exit 0
  sleep 5
done

echo "Контейнер web не стал healthy за отведённое время."
exit 1
