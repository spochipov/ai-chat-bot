#!/bin/bash

# Скрипт для деплоя AI Chat Bot на VPS
# Использование: ./scripts/deploy.sh [environment]

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Проверка аргументов
ENVIRONMENT=${1:-production}
if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "staging" ]]; then
    error "Invalid environment. Use 'production' or 'staging'"
fi

log "Starting deployment for $ENVIRONMENT environment..."

# Проверка наличия необходимых файлов
if [[ ! -f ".env" ]]; then
    error ".env file not found. Please create it from .env.example"
fi

if [[ ! -f "docker-compose.prod.yml" ]]; then
    error "docker-compose.prod.yml not found"
fi

# Проверка Docker
if ! command -v docker &> /dev/null; then
    error "Docker is not installed"
fi

if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose is not installed"
fi

# Проверка curl для health checks
if ! command -v curl &> /dev/null; then
    warn "curl is not installed, health checks will be skipped"
    SKIP_HEALTH_CHECKS=true
else
    SKIP_HEALTH_CHECKS=false
fi

log "Debug pwd"
pwd
log "Debug ln -s"
ln -s
log "Debug .env"
cat .env

# Загрузка переменных окружения
source .env

# Проверка обязательных переменных
required_vars=("BOT_TOKEN" "OPENROUTER_API_KEY" "DATABASE_URL" "REDIS_URL")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        error "Required environment variable $var is not set"
    fi
done

log "Environment variables validated"

# Создание резервной копии перед деплоем
log "Creating backup before deployment..."
if [[ -f "scripts/backup.sh" ]]; then
    ./scripts/backup.sh
else
    warn "Backup script not found, skipping backup"
fi

# Остановка текущих контейнеров
log "Stopping current containers..."
docker-compose -f docker-compose.prod.yml down --remove-orphans || true

# Очистка старых образов
log "Cleaning up old Docker images..."
docker system prune -f

# Сборка новых образов
log "Building new Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Запуск базы данных и Redis
log "Starting database and Redis..."
docker-compose -f docker-compose.prod.yml up -d postgres redis

# Ожидание готовности базы данных
log "Waiting for database to be ready..."
timeout=60
counter=0
while ! docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U postgres; do
    sleep 2
    counter=$((counter + 2))
    if [[ $counter -ge $timeout ]]; then
        error "Database failed to start within $timeout seconds"
    fi
done

# Применение миграций базы данных
log "Running database migrations..."
docker-compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

# Генерация Prisma клиента
log "Generating Prisma client..."
docker-compose -f docker-compose.prod.yml run --rm app npx prisma generate

# Запуск seed (если нужно)
if [[ "$ENVIRONMENT" == "staging" ]]; then
    log "Running database seed for staging..."
    docker-compose -f docker-compose.prod.yml run --rm app npx prisma db seed
fi

# Запуск приложения
log "Starting application..."
docker-compose -f docker-compose.prod.yml up -d app

# Ожидание готовности приложения
log "Waiting for application to be ready..."
timeout=120
counter=0
if [[ "$SKIP_HEALTH_CHECKS" == "false" ]]; then
    while ! curl -f http://localhost:3000/health &> /dev/null; do
        sleep 5
        counter=$((counter + 5))
        if [[ $counter -ge $timeout ]]; then
            error "Application failed to start within $timeout seconds"
        fi
    done
else
    # Если curl недоступен, просто ждем и проверяем статус контейнера
    while [[ $counter -lt $timeout ]]; do
        if docker-compose -f docker-compose.prod.yml ps app | grep -q "Up"; then
            log "Application container is running"
            break
        fi
        sleep 5
        counter=$((counter + 5))
    done
    if [[ $counter -ge $timeout ]]; then
        error "Application failed to start within $timeout seconds"
    fi
fi

# Запуск Nginx (если используется)
if docker-compose -f docker-compose.prod.yml config --services | grep -q nginx; then
    log "Starting Nginx..."
    docker-compose -f docker-compose.prod.yml up -d nginx
fi

# Проверка статуса всех сервисов
log "Checking service status..."
docker-compose -f docker-compose.prod.yml ps

# Проверка логов на наличие ошибок
log "Checking application logs for errors..."
if docker-compose -f docker-compose.prod.yml logs app | grep -i error; then
    warn "Errors found in application logs. Please check manually."
else
    log "No errors found in application logs"
fi

# Финальная проверка
log "Running final health checks..."

# Проверка health endpoint
if [[ "$SKIP_HEALTH_CHECKS" == "false" ]]; then
    if curl -f http://localhost:3000/health &> /dev/null; then
        log "✅ Health check passed"
    else
        error "❌ Health check failed"
    fi
else
    log "⚠️ Health check skipped (curl not available)"
fi

# Проверка подключения к базе данных
if docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d ai_chat_bot -c "SELECT 1;" &> /dev/null; then
    log "✅ Database connection successful"
else
    error "❌ Database connection failed"
fi

# Проверка Redis
if [[ -n "$REDIS_PASSWORD" ]]; then
    if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli -a "$REDIS_PASSWORD" ping | grep -q PONG; then
        log "✅ Redis connection successful"
    else
        error "❌ Redis connection failed"
    fi
else
    if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping | grep -q PONG; then
        log "✅ Redis connection successful"
    else
        error "❌ Redis connection failed"
    fi
fi

# Очистка неиспользуемых ресурсов
log "Cleaning up unused Docker resources..."
docker system prune -f --volumes

# Вывод информации о деплое
log "🎉 Deployment completed successfully!"
echo ""
echo -e "${BLUE}Deployment Summary:${NC}"
echo -e "${BLUE}==================${NC}"
echo -e "Environment: ${GREEN}$ENVIRONMENT${NC}"
echo -e "Timestamp: ${GREEN}$(date)${NC}"
echo -e "Application URL: ${GREEN}http://localhost:3000${NC}"
echo -e "Health Check: ${GREEN}http://localhost:3000/health${NC}"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "${BLUE}=================${NC}"
echo "View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "Stop services: docker-compose -f docker-compose.prod.yml down"
echo "Restart app: docker-compose -f docker-compose.prod.yml restart app"
echo "Database shell: docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_chat_bot"
echo "Redis shell: docker-compose -f docker-compose.prod.yml exec redis redis-cli"
echo ""

# Отправка уведомления (если настроено)
if [[ -n "$DEPLOY_WEBHOOK_URL" ]]; then
    log "Sending deployment notification..."
    curl -X POST "$DEPLOY_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"🚀 AI Chat Bot deployed successfully to $ENVIRONMENT at $(date)\"}" \
        &> /dev/null || warn "Failed to send deployment notification"
fi

log "Deployment script completed!"
