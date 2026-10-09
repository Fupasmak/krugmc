# Сборка сайта KRUG. Контекст сборки: корень монорепо.
# docker compose build web

FROM node:22-alpine AS deps
WORKDIR /app
# libc6-compat нужен sharp на alpine
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
COPY TGBOT/package.json TGBOT/package.json
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY web ./web
COPY TGBOT/package.json TGBOT/package.json
# Переменные сборки: настоящие значения приходят в рантайме из compose,
# здесь нужны только валидные заглушки, чтобы прошла проверка env.
ENV NODE_ENV=production \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    SITE_URL=http://localhost:3000 \
    NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
    SESSION_SECRET=build_placeholder_secret_build_placeholder_secret \
    MC_HMAC_SECRET=build_placeholder_secret_build_placeholder_secret \
    INTERNAL_API_SECRET=build_placeholder_secret_build_placeholder_secret
RUN npx prisma generate --schema web/prisma/schema.prisma \
    && npm run build --workspace=web

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat \
    && addgroup -g 1001 -S nodejs \
    && adduser -S krug -u 1001

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# standalone кладёт монорепо целиком: сервер лежит в web/server.js
COPY --from=builder --chown=krug:nodejs /app/web/.next/standalone ./
COPY --from=builder --chown=krug:nodejs /app/web/.next/static ./web/.next/static
COPY --from=builder --chown=krug:nodejs /app/web/public ./web/public
COPY --from=builder --chown=krug:nodejs /app/web/content ./web/content
COPY --from=builder --chown=krug:nodejs /app/web/prisma ./web/prisma
COPY --from=builder --chown=krug:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=krug:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=krug:nodejs /app/node_modules/@prisma ./node_modules/@prisma

RUN mkdir -p /app/uploads /app/web/public/cards && chown -R krug:nodejs /app/uploads /app/web/public

USER krug
EXPOSE 3000
WORKDIR /app/web

CMD ["node", "server.js"]
