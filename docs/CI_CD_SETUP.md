# Настройка CI/CD для AI Chat Bot

Этот документ описывает процесс настройки автоматического развертывания (CI/CD) для проекта AI Chat Bot с использованием GitHub Actions.

## Обзор

CI/CD пайплайн включает в себя:

1. **Тестирование** - автоматический запуск тестов при каждом push/PR
2. **Сборка** - создание Docker образа и публикация в GitHub Container Registry
3. **Развертывание** - автоматическое развертывание на production и staging серверах
4. **Безопасность** - сканирование уязвимостей в Docker образах

## Структура пайплайнов

### Production Pipeline (`.github/workflows/deploy.yml`)

Запускается при push в ветки `main` или `master`:

- ✅ Запуск тестов с PostgreSQL и Redis
- 🔨 Сборка и публикация Docker образа
- 🚀 Развертывание на production сервере
- 🔒 Сканирование безопасности
- 📢 Уведомления в Slack

### Staging Pipeline (`.github/workflows/staging.yml`)

Запускается при push в ветки `develop` или `staging`:

- ✅ Запуск тестов
- 🔨 Сборка staging образа
- 🧪 Развертывание на staging сервере
- 📊 Дополнительные проверки

## Настройка GitHub Secrets

### Обязательные секреты для Production

В настройках репозитория GitHub → Settings → Secrets and variables → Actions добавьте:

#### Серверные настройки
```
SSH_PRIVATE_KEY          # Приватный SSH ключ для доступа к серверу
SERVER_HOST              # IP адрес или домен production сервера
SERVER_USER              # Пользователь для SSH подключения
```

#### Переменные приложения
```
BOT_TOKEN                # Токен Telegram бота
ADMIN_TELEGRAM_ID        # ID администратора в Telegram
OPENROUTER_API_KEY       # API ключ OpenRouter
OPENROUTER_MODEL         # Модель AI (по умолчанию: openai/gpt-4)
JWT_SECRET               # Секретный ключ для JWT
ENCRYPTION_KEY           # Ключ для шифрования данных
```

#### База данных
```
POSTGRES_DB              # Имя базы данных
POSTGRES_USER            # Пользователь PostgreSQL
POSTGRES_PASSWORD        # Пароль PostgreSQL
REDIS_PASSWORD           # Пароль Redis (опционально)
```

#### Дополнительные настройки
```
LOG_LEVEL                # Уровень логирования (info, debug, error)
MAX_FILE_SIZE            # Максимальный размер файла (20971520)
ALLOWED_FILE_TYPES       # Разрешенные типы файлов
```

### Секреты для Staging (опционально)

Если используете staging окружение, добавьте аналогичные секреты с префиксом `STAGING_`:

```
STAGING_SSH_PRIVATE_KEY
STAGING_SERVER_HOST
STAGING_SERVER_USER
STAGING_BOT_TOKEN
STAGING_ADMIN_TELEGRAM_ID
# ... и так далее
```

### Уведомления (опционально)

```
SLACK_WEBHOOK_URL        # Webhook URL для уведомлений в Slack
```

## Подготовка сервера

### 1. Установка Docker и Docker Compose

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Создание пользователя для деплоя

```bash
# Создание пользователя
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy

# Настройка SSH ключей
sudo mkdir -p /home/deploy/.ssh
sudo touch /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# Добавление публичного ключа
echo "ваш_публичный_ключ" | sudo tee -a /home/deploy/.ssh/authorized_keys
```

### 3. Создание директорий

```bash
sudo mkdir -p /opt/ai-chat-bot
sudo chown deploy:deploy /opt/ai-chat-bot

# Для staging (если нужно)
sudo mkdir -p /opt/ai-chat-bot-staging
sudo chown deploy:deploy /opt/ai-chat-bot-staging
```

### 4. Настройка Nginx (опционально)

Если используете Nginx как reverse proxy:

```bash
sudo apt install nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## Генерация SSH ключей

```bash
# Генерация ключевой пары
ssh-keygen -t ed25519 -C "deploy@ai-chat-bot" -f ~/.ssh/ai-chat-bot-deploy

# Копирование публичного ключа на сервер
ssh-copy-id -i ~/.ssh/ai-chat-bot-deploy.pub deploy@your-server.com

# Добавление приватного ключа в GitHub Secrets
cat ~/.ssh/ai-chat-bot-deploy
```

## Настройка GitHub Environments

1. Перейдите в Settings → Environments
2. Создайте environment `production`
3. Настройте Protection rules:
   - ✅ Required reviewers (рекомендуется)
   - ✅ Wait timer (опционально)
   - ✅ Deployment branches (только main/master)

4. Создайте environment `staging` (если нужно)

## Процесс развертывания

### Автоматическое развертывание

1. **Production**: Push в ветку `main` или `master`
2. **Staging**: Push в ветку `develop` или `staging`

### Ручное развертывание

Staging можно запустить вручную:

1. Перейдите в Actions → Staging Deployment
2. Нажмите "Run workflow"
3. Выберите ветку и опции

## Мониторинг и логи

### Просмотр логов на сервере

```bash
# Логи приложения
docker-compose -f docker-compose.prod.yml logs -f app

# Логи всех сервисов
docker-compose -f docker-compose.prod.yml logs -f

# Статус сервисов
docker-compose -f docker-compose.prod.yml ps
```

### Health checks

Приложение предоставляет endpoint для проверки здоровья:

```bash
curl http://your-server.com/health
```

## Откат к предыдущей версии

```bash
# На сервере
cd /opt/ai-chat-bot

# Просмотр доступных образов
docker images | grep ai-chat-bot

# Откат к предыдущему образу
docker-compose -f docker-compose.prod.yml down
# Измените тег образа в docker-compose.prod.yml
docker-compose -f docker-compose.prod.yml up -d
```

## Резервное копирование

Скрипт `scripts/backup.sh` автоматически создает резервные копии перед каждым развертыванием.

Ручное создание бэкапа:

```bash
./scripts/backup.sh
```

## Устранение неполадок

### Проблемы с SSH

```bash
# Проверка SSH подключения
ssh -i ~/.ssh/ai-chat-bot-deploy deploy@your-server.com

# Проверка SSH агента в GitHub Actions
ssh-add -l
```

### Проблемы с Docker

```bash
# Очистка Docker
docker system prune -a

# Проверка места на диске
df -h

# Проверка логов Docker
sudo journalctl -u docker.service
```

### Проблемы с базой данных

```bash
# Подключение к базе данных
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_chat_bot

# Проверка миграций
docker-compose -f docker-compose.prod.yml exec app npx prisma migrate status
```

## Безопасность

1. **Секреты**: Никогда не коммитьте секреты в репозиторий
2. **SSH ключи**: Используйте отдельные ключи для каждого окружения
3. **Доступ**: Ограничьте SSH доступ только для необходимых IP
4. **Обновления**: Регулярно обновляйте зависимости и базовые образы
5. **Мониторинг**: Настройте мониторинг и алерты

## Дополнительные возможности

### Blue-Green Deployment

Для zero-downtime развертывания можно настроить Blue-Green deployment:

1. Запуск новой версии на альтернативном порту
2. Проверка работоспособности
3. Переключение трафика
4. Остановка старой версии

### Canary Deployment

Постепенное развертывание с переключением части трафика на новую версию.

### Автоматические тесты после развертывания

Добавление smoke tests и integration tests после развертывания.

## Поддержка

При возникновении проблем:

1. Проверьте логи GitHub Actions
2. Проверьте логи на сервере
3. Убедитесь в правильности настройки секретов
4. Проверьте доступность сервера и сервисов

---

**Примечание**: Этот документ описывает базовую настройку CI/CD. В зависимости от ваших требований, конфигурация может быть дополнена или изменена.
