# Руководство по деплою AI Chat Bot

## Быстрый старт

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Установка дополнительных утилит
sudo apt install -y curl git htop
```

### 2. Клонирование проекта

```bash
git clone https://github.com/spochipov/ai-chat-bot.git
cd ai-chat-bot
```

### 3. Настройка переменных окружения

```bash
# Копирование примера конфигурации
cp .env.prod.example .env

# Редактирование конфигурации
nano .env
```

**Обязательные переменные:**
- `BOT_TOKEN` - токен Telegram бота
- `ADMIN_TELEGRAM_ID` - ваш Telegram ID
- `OPENROUTER_API_KEY` - ключ OpenRouter API
- `POSTGRES_PASSWORD` - пароль для PostgreSQL
- `JWT_SECRET` - секретный ключ JWT (минимум 32 символа)
- `ENCRYPTION_KEY` - ключ шифрования (ровно 32 символа)

### 4. Деплой

```bash
# Запуск деплоя
chmod +x scripts/deploy.sh
./scripts/deploy.sh production
```

## Детальная настройка

### Переменные окружения

#### Telegram Bot
```env
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
ADMIN_TELEGRAM_ID=123456789
```

#### OpenRouter API
```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-4
```

#### База данных
```env
POSTGRES_DB=ai_chat_bot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secure_password_123
DATABASE_URL=postgresql://postgres:secure_password_123@postgres:5432/ai_chat_bot
```

#### Redis (опционально)
```env
REDIS_PASSWORD=redis_password_123
REDIS_URL=redis://:redis_password_123@redis:6379
```

#### Безопасность
```env
JWT_SECRET=your_very_long_jwt_secret_key_here
ENCRYPTION_KEY=exactly_32_characters_key_here!
```

### SSL/HTTPS настройка

1. Поместите SSL сертификаты в `docker/ssl/`:
   ```bash
   mkdir -p docker/ssl
   cp your_cert.pem docker/ssl/cert.pem
   cp your_key.pem docker/ssl/key.pem
   ```

2. Обновите nginx конфигурацию в `docker/nginx.conf`

3. Добавьте переменные в `.env`:
   ```env
   SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
   SSL_KEY_PATH=/etc/nginx/ssl/key.pem
   ```

## Управление деплоем

### Полезные команды

```bash
# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f

# Просмотр логов конкретного сервиса
docker-compose -f docker-compose.prod.yml logs -f app

# Перезапуск приложения
docker-compose -f docker-compose.prod.yml restart app

# Остановка всех сервисов
docker-compose -f docker-compose.prod.yml down

# Полная остановка с удалением volumes
docker-compose -f docker-compose.prod.yml down -v

# Подключение к базе данных
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_chat_bot

# Подключение к Redis
docker-compose -f docker-compose.prod.yml exec redis redis-cli

# Просмотр статуса сервисов
docker-compose -f docker-compose.prod.yml ps
```

### Обновление приложения

```bash
# Получение последних изменений
git pull origin main

# Повторный деплой
./scripts/deploy.sh production
```

### Резервное копирование

```bash
# Создание бэкапа базы данных
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres ai_chat_bot > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановление из бэкапа
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres ai_chat_bot < backup_file.sql
```

## Мониторинг

### Health checks

- **Приложение**: `http://your-server:3000/health`
- **Статус сервисов**: `docker-compose -f docker-compose.prod.yml ps`

### Логи

Логи приложения сохраняются в:
- Контейнер: `/app/logs/`
- Хост: `./logs/`

### Метрики ресурсов

```bash
# Использование ресурсов контейнерами
docker stats

# Использование дискового пространства
docker system df

# Очистка неиспользуемых ресурсов
docker system prune -f
```

## Troubleshooting

### Частые проблемы

1. **Контейнер не запускается**
   ```bash
   # Проверка логов
   docker-compose -f docker-compose.prod.yml logs app
   
   # Проверка переменных окружения
   docker-compose -f docker-compose.prod.yml config
   ```

2. **База данных недоступна**
   ```bash
   # Проверка статуса PostgreSQL
   docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres
   
   # Перезапуск базы данных
   docker-compose -f docker-compose.prod.yml restart postgres
   ```

3. **Redis недоступен**
   ```bash
   # Проверка Redis
   docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
   
   # С паролем
   docker-compose -f docker-compose.prod.yml exec redis redis-cli -a your_password ping
   ```

4. **Проблемы с миграциями**
   ```bash
   # Ручной запуск миграций
   docker-compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
   
   # Сброс базы данных (ОСТОРОЖНО!)
   docker-compose -f docker-compose.prod.yml run --rm app npx prisma migrate reset
   ```

### Проверка конфигурации

```bash
# Валидация docker-compose файла
docker-compose -f docker-compose.prod.yml config

# Проверка переменных окружения
docker-compose -f docker-compose.prod.yml run --rm app env | grep -E "(BOT_TOKEN|DATABASE_URL|REDIS_URL)"
```

## Безопасность

### Рекомендации

1. **Используйте сильные пароли** для всех сервисов
2. **Регулярно обновляйте** зависимости и образы
3. **Настройте firewall** для ограничения доступа
4. **Используйте SSL/HTTPS** для production
5. **Регулярно создавайте бэкапы**

### Firewall настройка

```bash
# Установка ufw
sudo apt install ufw

# Базовые правила
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Разрешение SSH
sudo ufw allow ssh

# Разрешение HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Активация firewall
sudo ufw enable
```

## Поддержка

При возникновении проблем:

1. Проверьте логи приложения
2. Убедитесь в правильности переменных окружения
3. Проверьте статус всех сервисов
4. Обратитесь к разделу Troubleshooting

Для получения помощи создайте issue в репозитории проекта.
