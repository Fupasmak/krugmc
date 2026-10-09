# Сборка Telegram-бота KRUG. Контекст сборки: корень монорепо.
# docker compose build bot

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
COPY TGBOT/package.json TGBOT/package.json
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY TGBOT ./TGBOT
COPY web/package.json web/package.json
COPY web/prisma ./web/prisma
RUN npx prisma generate --schema web/prisma/schema.prisma \
    && npm run build --workspace=TGBOT

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S krug -u 1001

COPY --from=builder --chown=krug:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=krug:nodejs /app/TGBOT/dist ./TGBOT/dist
COPY --from=builder --chown=krug:nodejs /app/TGBOT/package.json ./TGBOT/package.json
COPY --from=builder --chown=krug:nodejs /app/package.json ./package.json

USER krug
WORKDIR /app/TGBOT

CMD ["node", "dist/index.js"]
