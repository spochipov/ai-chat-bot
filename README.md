# AI Chat Bot для Telegram

Мощный Telegram бот с интеграцией OpenRouter API для доступа к различным AI моделям. Поддерживает обработку текста, изображений и файлов с системой контроля доступа и аналитикой.

## 🚀 Возможности

### Основные функции
- **Интеграция с OpenRouter API** - доступ к GPT-4, Claude, Gemini и другим моделям
- **Обработка файлов** - поддержка текстовых документов, изображений (PDF, DOCX, TXT, JPG, PNG)
- **Система контроля доступа** - ключи доступа для управления пользователями
- **Контекст чата** - сохранение истории сообщений для каждого пользователя
- **Rate limiting** - защита от спама и превышения лимитов
- **Админ панель** - управление пользователями, ключами и аналитика

### Технические особенности
- **TypeScript** - типобезопасность и современный код
- **PostgreSQL** - надежное хранение данных
- **Redis** - кэширование и сессии
- **Docker** - контейнеризация для легкого деплоя
- **Prisma ORM** - удобная работа с базой данных
- **Winston** - структурированное логирование
- **Nginx** - reverse proxy для production

## 📋 Требования

### Для разработки
- Node.js 18+ 
- npm или yarn
- PostgreSQL 14+
- Redis 6+

### Для production
- Docker и Docker Compose
- VPS с минимум 1GB RAM
- Домен (опционально, для HTTPS)

## 🛠 Установка и настройка

### 1. Клонирование репозитория

```bash
git clone https://github.com/spochipov/ai-chat-bot.git
cd ai-chat-bot
```

### 2. Установка зависимостей

```bash
yarn install
```

### 3. Настройка переменных окружения

```bash
cp .env.example .env
```

Отредактируйте `.env` файл:

```env
# Telegram Bot
BOT_TOKEN=your_telegram_bot_token

# OpenRouter API
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-4o
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_chat_bot

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Admin
ADMIN_TELEGRAM_ID=your_telegram_id

# AI Settings
DEFAULT_MAX_TOKENS=4000
DEFAULT_TEMPERATURE=0.7
MAX_CONTEXT_MESSAGES=20

# File Upload
MAX_FILE_SIZE=20971520
ALLOWED_FILE_TYPES=txt,pdf,docx,jpg,jpeg,png,gif,webp

# Rate Limiting
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX_REQUESTS=10

# Backup (опционально)
BACKUP_S3_BUCKET=your_s3_bucket
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret

# Webhooks (опционально)
DEPLOY_WEBHOOK_URL=your_deploy_webhook
BACKUP_WEBHOOK_URL=your_backup_webhook
```

### 4. Настройка базы данных

```bash
# Генерация Prisma клиента
npx prisma generate

# Применение миграций
npx prisma migrate dev

# Заполнение начальными данными
npx prisma db seed
```

### 5. Запуск в режиме разработки

```bash
yarn dev
```

## 🐳 Docker деплой

### Локальный запуск с Docker

```bash
# Сборка и запуск всех сервисов
docker-compose up -d

# Применение миграций
docker-compose exec app npx prisma migrate deploy

# Заполнение данными
docker-compose exec app npx prisma db seed
```

### Production деплой

```bash
# Копирование production конфигурации
cp .env.example .env
# Отредактируйте .env для production

# Запуск деплоя
chmod +x scripts/deploy.sh
./scripts/deploy.sh production
```

## 🔑 Управление доступом

### Создание ключей доступа

```bash
# Генерация нового ключа
yarn generate-key <admin_telegram_id>

# Или через Docker
docker-compose exec app yarn generate-key <admin_telegram_id>
```

### Команды администратора

В Telegram боте доступны следующие команды для администраторов:

- `/admin` - панель администратора
- `/generate_key` - создать новый ключ доступа
- `/list_keys` - список всех ключей
- `/deactivate_key` - деактивировать ключ
- `/list_users` - список пользователей
- `/user_stats <user_id>` - статистика пользователя
- `/balance` - баланс OpenRouter API
- `/analytics` - общая аналитика

## 📱 Использование бота

### Команды пользователя

- `/start` - начало работы и ввод ключа доступа
- `/help` - справка по командам
- `/clear` - очистка контекста чата
- `/status` - информация о пользователе

### Отправка сообщений

1. **Текстовые сообщения** - просто отправьте текст
2. **Файлы** - отправьте документ с описанием задачи
3. **Изображения** - отправьте фото для анализа

### Поддерживаемые форматы файлов

- **Текстовые**: TXT, PDF, DOCX
- **Изображения**: JPG, JPEG, PNG, GIF, WEBP

## 🔧 Разработка

### Структура проекта

```
ai-chat-bot/
├── src/
│   ├── app.ts              # Главный файл приложения
│   ├── bot/                # Telegram бот
│   │   ├── index.ts        # Основной файл бота
│   │   ├── handlers/       # Обработчики команд
│   │   └── middleware/     # Middleware функции
│   ├── services/           # Сервисы
│   │   ├── database.ts     # Работа с БД
│   │   ├── redis.ts        # Работа с Redis
│   │   └── openrouter.ts   # OpenRouter API
│   └── utils/              # Утилиты
│       └── logger.ts       # Логирование
├── prisma/                 # Схема БД и миграции
├── docker/                 # Docker конфигурации
├── scripts/                # Скрипты деплоя и бэкапа
└── docs/                   # Документация
```

### Доступные команды

```bash
# Разработка
yarn dev                 # Запуск в режиме разработки
yarn build               # Сборка проекта
yarn start               # Запуск production версии

# База данных
yarn db:migrate          # Применение миграций
yarn db:seed             # Заполнение данными
yarn db:studio           # Prisma Studio
yarn db:reset            # Сброс БД

# Утилиты
yarn generate-key        # Генерация ключа доступа
yarn lint                # Проверка кода
yarn format              # Форматирование кода

# Docker
yarn docker:build        # Сборка Docker образа
yarn docker:run          # Запуск контейнеров
yarn docker:stop         # Остановка контейнеров
```

### Добавление новых команд

1. Создайте обработчик в `src/bot/handlers/`
2. Добавьте импорт в `src/bot/index.ts`
3. Зарегистрируйте команду в боте

Пример:

```typescript
// src/bot/handlers/myCommand.ts
import { BotContext } from '../index';

export const myCommandHandler = async (ctx: BotContext) => {
  await ctx.reply('Моя новая команда!');
};

// src/bot/index.ts
import { myCommandHandler } from './handlers/myCommand';

bot.command('mycommand', myCommandHandler);
```

## 📊 Мониторинг и логи

### Просмотр логов

```bash
# Docker логи
docker-compose logs -f app

# Файловые логи (в production)
tail -f logs/application-$(date +%Y-%m-%d).log
tail -f logs/error-$(date +%Y-%m-%d).log
```

### Метрики

Приложение предоставляет следующие эндпоинты:

- `/health` - проверка состояния
- `/metrics` - метрики Prometheus (если настроено)

## 🔒 Безопасность

### Рекомендации

1. **Используйте сильные пароли** для БД и Redis
2. **Ограничьте доступ** к админским командам
3. **Настройте HTTPS** для production
4. **Регулярно обновляйте** зависимости
5. **Мониторьте логи** на предмет подозрительной активности

### Rate Limiting

Встроенная защита от спама:
- 10 запросов в минуту на пользователя
- Отдельные лимиты для webhook'ов
- Автоматическая блокировка при превышении

## 💾 Резервное копирование

### Создание бэкапа

```bash
# Полный бэкап
./scripts/backup.sh full

# Только база данных
./scripts/backup.sh database

# Только файлы
./scripts/backup.sh files
```

### Восстановление

```bash
# Восстановление БД из бэкапа
gunzip -c backup_file.sql.gz | docker-compose exec -T postgres psql -U postgres -d ai_chat_bot

# Восстановление файлов
tar -xzf backup_files.tar.gz
```

## 🚀 CI/CD и автоматическое развертывание

### Быстрая настройка CI/CD (5 минут)

Проект включает полностью настроенный CI/CD пайплайн с GitHub Actions для автоматического развертывания.

```bash
# 1. Настройка сервера одной командой
chmod +x scripts/setup-server.sh
./scripts/setup-server.sh YOUR_SERVER_IP YOUR_SSH_USER

# 2. Добавьте секреты в GitHub (список выведется после выполнения скрипта)

# 3. Отправьте код в main ветку
git push origin main
```

**Готово!** 🎉 Ваше приложение автоматически развернется на сервере.

#### Что включает CI/CD:

- ✅ **Автоматическое тестирование** при каждом push/PR
- 🔨 **Сборка Docker образов** и публикация в GitHub Container Registry  
- 🚀 **Развертывание на production** при push в main
- 🧪 **Staging окружение** для ветки develop
- 🔒 **Сканирование безопасности** Docker образов
- 📢 **Уведомления в Slack** о статусе развертывания

#### Документация CI/CD:

- 📖 [Быстрый старт CI/CD](docs/QUICK_START_CICD.md) - настройка за 5 минут
- 📚 [Полная документация CI/CD](docs/CI_CD_SETUP.md) - детальное руководство
- 🔧 [Пример переменных окружения](.env.cicd.example) - шаблон для GitHub Secrets

### Ручной деплой на VPS

Если вы предпочитаете ручное развертывание:

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Клонирование проекта
git clone https://github.com/spochipov/ai-chat-bot.git
cd ai-chat-bot
```

### Настройка SSL (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install certbot

# Получение сертификата
sudo certbot certonly --standalone -d your-domain.com

# Копирование сертификатов
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/ssl/key.pem
```

### Автоматическое обновление

Добавьте в crontab:

```bash
# Ежедневный бэкап в 2:00
0 2 * * * /path/to/ai-chat-bot/scripts/backup.sh full

# Обновление SSL сертификатов
0 3 * * 1 certbot renew --quiet
```

## 🤝 Участие в разработке

### Как внести вклад

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Добавьте тесты
5. Отправьте Pull Request

### Стиль кода

Проект использует:
- ESLint для проверки кода
- Prettier для форматирования
- Conventional Commits для сообщений коммитов

## 📄 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 🆘 Поддержка

### Часто задаваемые вопросы

**Q: Как получить токен Telegram бота?**
A: Напишите @BotFather в Telegram и следуйте инструкциям.

**Q: Где получить API ключ OpenRouter?**
A: Зарегистрируйтесь на [openrouter.ai](https://openrouter.ai) и создайте API ключ.

**Q: Бот не отвечает на сообщения**
A: Проверьте логи приложения и убедитесь, что все сервисы запущены.

**Q: Как добавить новую AI модель?**
A: Измените переменную `OPENROUTER_MODEL` в `.env` файле.

### Получение помощи

- 📧 Email: support@example.com
- 💬 Telegram: @your_support_bot
- 🐛 Issues: [GitHub Issues](https://github.com/spochipov/ai-chat-bot/issues)

## 🔄 Обновления

### Версия 1.0.0
- Базовая функциональность
- Интеграция с OpenRouter
- Система контроля доступа
- Docker поддержка

### Планы развития
- [ ] Веб интерфейс для администрирования
- [ ] Поддержка голосовых сообщений
- [ ] Интеграция с другими AI провайдерами
- [ ] Система плагинов
- [ ] Мультиязычность

---

**Создано с ❤️ для сообщества разработчиков**
