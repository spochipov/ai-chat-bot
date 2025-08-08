#!/bin/bash

# Скрипт для создания резервных копий AI Chat Bot
# Использование: ./scripts/backup.sh [type]

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

# Конфигурация
BACKUP_TYPE=${1:-full}
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="ai_chat_bot_backup_${TIMESTAMP}"

# Проверка типа резервной копии
if [[ "$BACKUP_TYPE" != "full" && "$BACKUP_TYPE" != "database" && "$BACKUP_TYPE" != "files" ]]; then
    error "Invalid backup type. Use 'full', 'database', or 'files'"
fi

log "Starting $BACKUP_TYPE backup..."

# Создание директории для резервных копий
mkdir -p "$BACKUP_DIR"

# Загрузка переменных окружения
if [[ -f ".env" ]]; then
    source .env
else
    warn ".env file not found, using default values"
fi

# Функция для резервного копирования базы данных
backup_database() {
    log "Creating database backup..."
    
    local db_backup_file="$BACKUP_DIR/${BACKUP_NAME}_database.sql"
    
    # Проверка, запущен ли контейнер с базой данных
    if docker-compose ps postgres | grep -q "Up"; then
        # Создание дампа через Docker
        docker-compose exec -T postgres pg_dump -U postgres -d ai_chat_bot > "$db_backup_file"
        log "Database backup created: $db_backup_file"
    elif command -v pg_dump &> /dev/null && [[ -n "$DATABASE_URL" ]]; then
        # Создание дампа напрямую (если PostgreSQL установлен локально)
        pg_dump "$DATABASE_URL" > "$db_backup_file"
        log "Database backup created: $db_backup_file"
    else
        error "Cannot create database backup. PostgreSQL not available."
    fi
    
    # Сжатие дампа
    gzip "$db_backup_file"
    log "Database backup compressed: ${db_backup_file}.gz"
}

# Функция для резервного копирования файлов
backup_files() {
    log "Creating files backup..."
    
    local files_backup_file="$BACKUP_DIR/${BACKUP_NAME}_files.tar.gz"
    
    # Список директорий и файлов для резервного копирования
    local backup_items=(
        "uploads"
        "logs"
        ".env"
        "docker-compose.prod.yml"
        "docker/nginx.conf"
    )
    
    # Создание архива только существующих файлов и директорий
    local existing_items=()
    for item in "${backup_items[@]}"; do
        if [[ -e "$item" ]]; then
            existing_items+=("$item")
        fi
    done
    
    if [[ ${#existing_items[@]} -gt 0 ]]; then
        tar -czf "$files_backup_file" "${existing_items[@]}"
        log "Files backup created: $files_backup_file"
    else
        warn "No files found to backup"
    fi
}

# Функция для резервного копирования Redis
backup_redis() {
    log "Creating Redis backup..."
    
    local redis_backup_file="$BACKUP_DIR/${BACKUP_NAME}_redis.rdb"
    
    # Проверка, запущен ли контейнер с Redis
    if docker-compose ps redis | grep -q "Up"; then
        # Создание снапшота Redis
        docker-compose exec -T redis redis-cli BGSAVE
        
        # Ожидание завершения сохранения
        while [[ $(docker-compose exec -T redis redis-cli LASTSAVE) == $(docker-compose exec -T redis redis-cli LASTSAVE) ]]; do
            sleep 1
        done
        
        # Копирование файла дампа
        docker-compose exec -T redis cat /data/dump.rdb > "$redis_backup_file"
        
        # Сжатие дампа
        gzip "$redis_backup_file"
        log "Redis backup created: ${redis_backup_file}.gz"
    else
        warn "Redis container is not running, skipping Redis backup"
    fi
}

# Функция для создания метаданных резервной копии
create_metadata() {
    local metadata_file="$BACKUP_DIR/${BACKUP_NAME}_metadata.json"
    
    cat > "$metadata_file" << EOF
{
    "backup_name": "$BACKUP_NAME",
    "backup_type": "$BACKUP_TYPE",
    "timestamp": "$TIMESTAMP",
    "date": "$(date -Iseconds)",
    "hostname": "$(hostname)",
    "user": "$(whoami)",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
    "docker_images": $(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}" | grep ai-chat-bot || echo '[]'),
    "environment_variables": {
        "NODE_ENV": "${NODE_ENV:-unknown}",
        "BOT_TOKEN": "${BOT_TOKEN:0:10}...",
        "OPENROUTER_MODEL": "${OPENROUTER_MODEL:-unknown}"
    }
}
EOF
    
    log "Metadata created: $metadata_file"
}

# Выполнение резервного копирования в зависимости от типа
case "$BACKUP_TYPE" in
    "database")
        backup_database
        ;;
    "files")
        backup_files
        ;;
    "full")
        backup_database
        backup_files
        backup_redis
        ;;
esac

# Создание метаданных
create_metadata

# Создание общего архива для полной резервной копии
if [[ "$BACKUP_TYPE" == "full" ]]; then
    log "Creating full backup archive..."
    
    local full_backup_file="$BACKUP_DIR/${BACKUP_NAME}_full.tar.gz"
    
    # Поиск всех файлов резервной копии
    local backup_files=($(find "$BACKUP_DIR" -name "${BACKUP_NAME}_*" -type f))
    
    if [[ ${#backup_files[@]} -gt 0 ]]; then
        tar -czf "$full_backup_file" -C "$BACKUP_DIR" $(basename -a "${backup_files[@]}")
        
        # Удаление отдельных файлов после создания общего архива
        rm -f "${backup_files[@]}"
        
        log "Full backup archive created: $full_backup_file"
    fi
fi

# Очистка старых резервных копий (оставляем последние 7)
log "Cleaning up old backups..."
find "$BACKUP_DIR" -name "ai_chat_bot_backup_*" -type f -mtime +7 -delete
log "Old backups cleaned up"

# Вычисление размера резервной копии
backup_size=$(du -sh "$BACKUP_DIR" | cut -f1)
log "Total backup size: $backup_size"

# Проверка целостности архивов
log "Verifying backup integrity..."
for archive in "$BACKUP_DIR"/${BACKUP_NAME}_*.tar.gz; do
    if [[ -f "$archive" ]]; then
        if tar -tzf "$archive" >/dev/null 2>&1; then
            log "✅ Archive integrity verified: $(basename "$archive")"
        else
            error "❌ Archive integrity check failed: $(basename "$archive")"
        fi
    fi
done

for gzip_file in "$BACKUP_DIR"/${BACKUP_NAME}_*.gz; do
    if [[ -f "$gzip_file" && ! "$gzip_file" =~ \.tar\.gz$ ]]; then
        if gzip -t "$gzip_file" 2>/dev/null; then
            log "✅ Gzip file integrity verified: $(basename "$gzip_file")"
        else
            error "❌ Gzip file integrity check failed: $(basename "$gzip_file")"
        fi
    fi
done

# Отправка резервной копии в облако (если настроено)
if [[ -n "$BACKUP_S3_BUCKET" && -n "$AWS_ACCESS_KEY_ID" ]]; then
    log "Uploading backup to S3..."
    
    if command -v aws &> /dev/null; then
        for backup_file in "$BACKUP_DIR"/${BACKUP_NAME}_*; do
            if [[ -f "$backup_file" ]]; then
                aws s3 cp "$backup_file" "s3://$BACKUP_S3_BUCKET/ai-chat-bot/" || warn "Failed to upload $(basename "$backup_file") to S3"
            fi
        done
        log "Backup uploaded to S3"
    else
        warn "AWS CLI not found, skipping S3 upload"
    fi
fi

# Отправка уведомления о резервной копии
if [[ -n "$BACKUP_WEBHOOK_URL" ]]; then
    log "Sending backup notification..."
    
    curl -X POST "$BACKUP_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"💾 AI Chat Bot backup completed: $BACKUP_TYPE backup created at $(date)\"}" \
        &> /dev/null || warn "Failed to send backup notification"
fi

# Вывод итоговой информации
log "🎉 Backup completed successfully!"
echo ""
echo -e "${BLUE}Backup Summary:${NC}"
echo -e "${BLUE}===============${NC}"
echo -e "Type: ${GREEN}$BACKUP_TYPE${NC}"
echo -e "Timestamp: ${GREEN}$TIMESTAMP${NC}"
echo -e "Location: ${GREEN}$BACKUP_DIR${NC}"
echo -e "Size: ${GREEN}$backup_size${NC}"
echo ""
echo -e "${BLUE}Backup Files:${NC}"
echo -e "${BLUE}==============${NC}"
ls -lh "$BACKUP_DIR"/${BACKUP_NAME}_* 2>/dev/null || echo "No backup files found"
echo ""

log "Backup script completed!"
