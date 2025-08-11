# Быстрый старт CI/CD

Это краткое руководство поможет вам быстро настроить автоматическое развертывание для AI Chat Bot.

## 🚀 Быстрая настройка (5 минут)

### 1. Подготовка сервера

Запустите скрипт автоматической настройки сервера:

```bash
# Сделайте скрипт исполняемым (если еще не сделано)
chmod +x scripts/setup-server.sh

# Запустите настройку сервера
./scripts/setup-server.sh YOUR_SERVER_IP YOUR_SSH_USER
```

Скрипт автоматически:
- Установит Docker и Docker Compose
- Создаст пользователя `deploy`
- Настроит SSH ключи
- Сконфигурирует firewall
- Создаст необходимые директории

### 2. Настройка GitHub Secrets

Перейдите в ваш репозиторий GitHub → Settings → Secrets and variables → Actions

#### Обязательные секреты:

**Сервер:**
```
SSH_PRIVATE_KEY          # Приватный ключ (выведется после выполнения скрипта)
SERVER_HOST              # IP адрес вашего сервера
SERVER_USER              # deploy
```

**Приложение:**
```
BOT_TOKEN                # Токен вашего Telegram бота
ADMIN_TELEGRAM_ID        # Ваш Telegram ID
OPENROUTER_API_KEY       # API ключ OpenRouter
JWT_SECRET               # Любая случайная строка (32+ символов)
ENCRYPTION_KEY           # Любая случайная строка (32+ символов)
```

**База данных:**
```
POSTGRES_DB              # ai_chat_bot
POSTGRES_USER            # postgres
POSTGRES_PASSWORD        # Надежный пароль
REDIS_PASSWORD           # Пароль для Redis (опционально)
```

### 3. Первое развертывание

```bash
# Закоммитьте изменения
git add .
git commit -m "Add CI/CD configuration"

# Отправьте в main ветку
git push origin main
```

Развертывание запустится автоматически! 🎉

## 📋 Проверочный список

- [ ] Сервер настроен с помощью `setup-server.sh`
- [ ] Все GitHub Secrets добавлены
- [ ] Код отправлен в ветку `main`
- [ ] GitHub Actions запустился без ошибок
- [ ] Приложение доступно на сервере

## 🔧 Полезные команды

### На сервере:

```bash
# Проверка статуса
sudo /usr/local/bin/ai-chat-bot-status.sh

# Просмотр логов
docker-compose -f /opt/ai-chat-bot/docker-compose.prod.yml logs -f

# Перезапуск приложения
docker-compose -f /opt/ai-chat-bot/docker-compose.prod.yml restart app

# Очистка Docker
docker system prune -f
```

### Локально:

```bash
# Проверка SSH подключения
ssh -i ~/.ssh/ai-chat-bot-deploy deploy@YOUR_SERVER_IP

# Ручной запуск деплоя
git push origin main
```

## 🐛 Устранение проблем

### Ошибки в GitHub Actions

1. Проверьте логи в разделе Actions
2. Убедитесь, что все секреты добавлены
3. Проверьте SSH подключение к серверу

### Приложение не запускается

```bash
# Проверьте логи
docker logs ai-chat-bot-app-prod

# Проверьте переменные окружения
docker exec ai-chat-bot-app-prod env | grep -E "(BOT_TOKEN|DATABASE_URL)"

# Проверьте базу данных
docker exec ai-chat-bot-postgres-prod pg_isready
```

### Проблемы с портами

```bash
# Проверьте занятые порты
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Остановите конфликтующие сервисы
sudo systemctl stop apache2  # если установлен
sudo systemctl stop nginx    # если конфликтует
```

## 🔄 Staging окружение (опционально)

Для настройки staging окружения:

1. Добавьте секреты с префиксом `STAGING_`:
   ```
   STAGING_SSH_PRIVATE_KEY
   STAGING_SERVER_HOST
   STAGING_SERVER_USER
   STAGING_BOT_TOKEN
   # ... и так далее
   ```

2. Создайте ветку `develop`:
   ```bash
   git checkout -b develop
   git push origin develop
   ```

3. Push в `develop` будет разворачивать на staging

## 📚 Дополнительная информация

- [Полная документация CI/CD](CI_CD_SETUP.md)
- [Техническая спецификация](TECHNICAL_SPECIFICATION.md)
- [Архитектура проекта](ARCHITECTURE.md)

## 🆘 Поддержка

Если возникли проблемы:

1. Проверьте [документацию по устранению неполадок](CI_CD_SETUP.md#устранение-неполадок)
2. Изучите логи GitHub Actions
3. Проверьте логи на сервере
4. Убедитесь в правильности всех секретов

---

**Поздравляем!** 🎉 Ваш CI/CD пайплайн настроен и готов к работе!
