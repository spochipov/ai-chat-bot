# Настройка GitHub Packages для AI Chat Bot

## Проблема

При деплое через GitHub Actions возникает ошибка:
```
ERROR: failed to push ghcr.io/spochipov/ai-chat-bot:main: denied: installation not allowed to Create organization package
```

## Решения

### 1. Настройка разрешений в репозитории

#### Шаг 1: Настройка Actions permissions
1. Перейдите в настройки репозитория: `Settings` → `Actions` → `General`
2. В разделе "Workflow permissions" выберите:
   - ✅ **Read and write permissions**
   - ✅ **Allow GitHub Actions to create and approve pull requests**

#### Шаг 2: Настройка Package permissions
1. Перейдите в `Settings` → `Actions` → `General`
2. Прокрутите до раздела "Workflow permissions"
3. Убедитесь, что включены права на packages

### 2. Настройка разрешений для организации (если репозиторий в организации)

#### Шаг 1: Настройки организации
1. Перейдите в настройки организации: `Settings` → `Actions` → `General`
2. В разделе "Policies" выберите:
   - ✅ **Allow all actions and reusable workflows**

#### Шаг 2: Package permissions для организации
1. Перейдите в `Settings` → `Packages`
2. В разделе "Package creation" выберите:
   - ✅ **Public** (если пакеты должны быть публичными)
   - ✅ **Private** (если пакеты должны быть приватными)

### 3. Альтернативное решение: Использование Personal Access Token

Если проблема с разрешениями не решается, можно использовать Personal Access Token:

#### Шаг 1: Создание PAT
1. Перейдите в `Settings` → `Developer settings` → `Personal access tokens` → `Tokens (classic)`
2. Нажмите `Generate new token (classic)`
3. Выберите scopes:
   - ✅ `write:packages`
   - ✅ `read:packages`
   - ✅ `delete:packages` (опционально)
4. Скопируйте созданный токен

#### Шаг 2: Добавление токена в секреты
1. Перейдите в настройки репозитория: `Settings` → `Secrets and variables` → `Actions`
2. Нажмите `New repository secret`
3. Имя: `GHCR_TOKEN`
4. Значение: ваш Personal Access Token

#### Шаг 3: Обновление workflow
Замените в `.github/workflows/deploy.yml`:

```yaml
- name: Log in to Container Registry
  uses: docker/login-action@v3
  with:
    registry: ${{ env.REGISTRY }}
    username: ${{ github.actor }}
    password: ${{ secrets.GHCR_TOKEN }}  # Вместо GITHUB_TOKEN
```

### 4. Проверка настроек пакета

После успешного создания пакета:

1. Перейдите в раздел `Packages` вашего профиля/организации
2. Найдите пакет `ai-chat-bot`
3. Перейдите в `Package settings`
4. Убедитесь, что:
   - Visibility настроена правильно (Public/Private)
   - Repository имеет доступ к пакету

## Текущие настройки workflow

В файле `.github/workflows/deploy.yml` уже добавлены необходимые разрешения:

```yaml
permissions:
  contents: read
  packages: write
  security-events: write
```

И обновлено имя образа:

```yaml
env:
  REGISTRY: ghcr.io
  IMAGE_NAME: spochipov/ai-chat-bot
```

## Проверка работы

После применения изменений:

1. Сделайте commit и push в main ветку
2. Проверьте выполнение GitHub Actions
3. Убедитесь, что образ успешно загружается в GHCR
4. Проверьте, что деплой проходит успешно

## Полезные команды

### Локальная проверка образа
```bash
# Логин в GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Загрузка образа
docker pull ghcr.io/spochipov/ai-chat-bot:latest

# Запуск образа локально
docker run --rm ghcr.io/spochipov/ai-chat-bot:latest
```

### Проверка разрешений через API
```bash
# Проверка разрешений токена
curl -H "Authorization: token $GITHUB_TOKEN" \
     https://api.github.com/user

# Проверка разрешений на пакеты
curl -H "Authorization: token $GITHUB_TOKEN" \
     https://api.github.com/user/packages
```

## Troubleshooting

### Ошибка "installation not allowed"
- Проверьте настройки организации
- Убедитесь, что у GitHub App есть разрешения на packages
- Попробуйте использовать Personal Access Token

### Ошибка "unauthorized"
- Проверьте правильность токена
- Убедитесь, что токен имеет scope `write:packages`
- Проверьте, что токен не истек

### Ошибка "package already exists"
- Проверьте настройки visibility пакета
- Убедитесь, что у репозитория есть доступ к пакету
- Попробуйте удалить пакет и создать заново

## Дополнительные ресурсы

- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [Working with the Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Authenticating to GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-to-the-container-registry)
