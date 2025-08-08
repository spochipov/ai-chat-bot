# Multi-stage build для оптимизации размера образа

# Development stage
FROM node:18-alpine AS development

WORKDIR /app

# Установка зависимостей для сборки нативных модулей
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    openssl-dev \
    openssl

# Копирование package.json и yarn.lock
COPY package.json yarn.lock ./

# Установка зависимостей
RUN yarn install --frozen-lockfile

# Копирование исходного кода
COPY . .

# Генерация Prisma клиента
RUN npx prisma generate

# Создание директории для загрузок
RUN mkdir -p uploads

EXPOSE 3000

CMD ["yarn", "dev"]

# Production build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Установка зависимостей для сборки
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    openssl-dev \
    openssl

# Копирование package.json и yarn.lock
COPY package.json yarn.lock ./

# Установка всех зависимостей (включая dev)
RUN yarn install --frozen-lockfile

# Копирование исходного кода
COPY . .

# Генерация Prisma клиента
RUN yarn prisma generate

# Сборка приложения
RUN yarn build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Установка только runtime зависимостей
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype \
    openssl

# Создание пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Копирование package.json и yarn.lock
COPY package.json yarn.lock ./

# Установка только production зависимостей
RUN if [ "$YARN_PRODUCTION" = "true" ]; then yarn install --frozen-lockfile --production; else yarn install --frozen-lockfile; fi && yarn cache clean

# Копирование собранного приложения
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Создание директории для загрузок
RUN mkdir -p uploads && chown -R nodejs:nodejs uploads
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["yarn", "start"]
