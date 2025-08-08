# Быстрый старт AI Chat Bot

Это руководство поможет вам быстро запустить AI Chat Bot для Telegram локально или на сервере.

## 🚀 Быстрый запуск (5 минут)

### Предварительные требования

1. **Telegram Bot Token**
   - Напишите [@BotFather](https://t.me/BotFather) в Telegram
   - Создайте нового бота командой `/newbot`
   - Сохраните полученный токен

2. **OpenRouter API Key**
   - Зарегистрируйтесь на [openrouter.ai](https://openrouter.ai)
   - Перейдите в раздел "Keys" и создайте новый API ключ
   - Пополните баланс (минимум $5 для тестирования)

3. **Docker и Docker Compose**
   ```bash
   # Установка Docker (Ubuntu/Debian)
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # Установка Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

### Шаг 1: Клонирование и настройка

```bash
# Клонирование репозитория
git clone https://github.com/spochipov/ai-chat-bot.git
cd ai-chat-bot

# Копирование конфигурации
cp .env.example .env
```

### Шаг 2: Настройка переменных окружения

Отредактируйте файл `.env`:

```env
# Обязательные параметры
BOT_TOKEN=your_telegram_bot_token_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
ADMIN_TELEGRAM_ID=your_telegram_user_id

# Параметры базы данных для production
POSTGRES_DB=ai_chat_bot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_strong_password_here

# Остальные параметры можно оставить по умолчанию
OPENROUTER_MODEL=openai/gpt-4o
DATABASE_URL=postgresql://postgres:your_strong_password_here@postgres:5432/ai_chat_bot
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your_redis_password_here
NODE_ENV=production
YARN_PRODUCTION=true
```

**Как узнать свой Telegram ID:**
1. Напишите [@userinfobot](https://t.me/userinfobot)
2. Скопируйте ваш ID из ответа

### Шаг 3: Запуск

```bash
# Запуск всех сервисов
docker-compose -f docker-compose.prod.yml up -d

# Применение миграций базы данных
docker-compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# Генерация Prisma клиента
docker-compose -f docker-compose.prod.yml exec app npx prisma generate

# Заполнение начальными данными
docker-compose -f docker-compose.prod.yml exec app npx prisma db seed
```

### Шаг 4: Проверка работы

```bash
# Проверка статуса сервисов
docker-compose -f docker-compose.prod.yml ps

# Проверка логов
docker-compose -f docker-compose.prod.yml logs -f app

# Проверка health endpoint
curl http://localhost:3000/health
```

### Шаг 5: Получение ключа доступа

```bash
# Генерация ключа доступа для администратора
docker-compose -f docker-compose.prod.yml exec app yarn generate-key $ADMIN_TELEGRAM_ID
```

Сохраните полученный ключ - он понадобится для первого входа в бота.

## 🎯 Первое использование

1. **Найдите вашего бота в Telegram** по имени, которое вы указали при создании
2. **Отправьте команду** `/start`
3. **Введите ключ доступа**, который вы получили на предыдущем шаге
4. **Отправьте любое сообщение** для тестирования

Пример диалога:
```
Вы: /start
Бот: Добро пожаловать! Введите ключ доступа:

Вы: ACK_1234567890ABCDEF...
Бот: ✅ Доступ предоставлен! Теперь вы можете пользоваться ботом.

Вы: Привет! Как дела?
Бот: Привет! У меня всё отлично, спасибо! Я готов помочь вам с любыми вопросами...
```

## 🛠 Локальная разработка

Если вы хотите разрабатывать бота локально:

```bash
# Установка зависимостей
yarn install

# Запуск только базы данных и Redis
docker-compose up -d postgres redis

# Настройка базы данных
yarn prisma migrate dev
yarn db:seed

# Запуск в режиме разработки
yarn dev
```

## 📋 Полезные команды

### Управление сервисами
```bash
# Остановка всех сервисов
docker-compose -f docker-compose.prod.yml down

# Перезапуск приложения
docker-compose -f docker-compose.prod.yml restart app

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f

# Обновление после изменений в коде
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Управление пользователями
```bash
# Генерация нового ключа доступа
docker-compose -f docker-compose.prod.yml exec app yarn generate-key <admin_telegram_id>

# Подключение к базе данных
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d ai_chat_bot

# Подключение к Redis
docker-compose -f docker-compose.prod.yml exec redis redis-cli
```

### Резервное копирование
```bash
# Создание полного бэкапа
./scripts/backup.sh full

# Создание бэкапа только базы данных
./scripts/backup.sh database
```

## 🔧 Настройка для production

### 1. Безопасность
```bash
# Смените пароли в .env
DATABASE_URL=postgresql://postgres:STRONG_PASSWORD@postgres:5432/ai_chat_bot
REDIS_PASSWORD=STRONG_REDIS_PASSWORD
```

### 2. SSL сертификат (опционально)
```bash
# Установка Certbot
sudo apt install certbot

# Получение сертификата
sudo certbot certonly --standalone -d your-domain.com

# Копирование сертификатов
sudo mkdir -p docker/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/ssl/key.pem
```

### 3. Автоматические бэкапы
```bash
# Добавление в crontab
crontab -e

# Добавьте строку для ежедневного бэкапа в 2:00
0 2 * * * /path/to/ai-chat-bot/scripts/backup.sh full
```

## ❗ Решение проблем

### Конфликт портов
Если при запуске возникает ошибка "port is already allocated":

```bash
# Проверьте занятые порты
sudo netstat -tulpn | grep :6379
sudo netstat -tulpn | grep :5432

# Остановите конфликтующие сервисы
sudo systemctl stop redis
sudo systemctl stop postgresql

# Или используйте альтернативные порты в docker-compose.yml:
# PostgreSQL: 5433:5432
# Redis: 6380:6379
```

### Бот не отвечает
```bash
# Проверьте логи
docker-compose -f docker-compose.prod.yml logs app

# Проверьте статус сервисов
docker-compose -f docker-compose.prod.yml ps

# Перезапустите приложение
docker-compose -f docker-compose.prod.yml restart app
```

### Ошибки базы данных
```bash
# Проверьте подключение к БД
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Примените миграции заново
docker-compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

### Проблемы с OpenRouter API
```bash
# Проверьте баланс API ключа
curl -H "Authorization: Bearer YOUR_API_KEY" https://openrouter.ai/api/v1/auth/key

# Проверьте логи на ошибки API
docker-compose -f docker-compose.prod.yml logs app | grep -i openrouter
```

## 📚 Дополнительная информация

- **Полная документация**: [README.md](../README.md)
- **Архитектура системы**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **API документация**: [API.md](API.md)
- **Вопросы и поддержка**: [GitHub Issues](https://github.com/spochipov/ai-chat-bot/issues)

## 🎉 Готово!

Ваш AI Chat Bot готов к использованию! Теперь вы можете:

- ✅ Общаться с различными AI моделями через Telegram
- ✅ Отправлять файлы для анализа
- ✅ Управлять пользователями через админ команды
- ✅ Мониторить использование и статистику

**Следующие шаги:**
1. Создайте дополнительные ключи доступа для других пользователей
2. Настройте мониторинг и алерты
3. Изучите админские команды для управления ботом
4. Настройте автоматические бэкапы

Удачного использования! 🚀
