# Тесты для AI Chat Bot

Этот проект содержит комплексную систему тестирования для Telegram бота с интеграцией OpenRouter API.

## Структура тестов

```
tests/
├── setup.ts                           # Настройка тестовой среды
├── bot/
│   └── handlers/
│       └── start.test.ts              # Тесты обработчика /start
├── services/
│   ├── database.test.ts               # Тесты сервиса базы данных
│   └── openrouter.test.ts             # Тесты сервиса OpenRouter
├── utils/
│   └── logger.test.ts                 # Тесты логгера
├── integration/
│   └── bot.integration.test.ts        # Интеграционные тесты
└── README.md                          # Этот файл
```

## Типы тестов

### 1. Unit тесты (Модульные тесты)
- **Цель**: Тестирование отдельных функций и методов в изоляции
- **Расположение**: `tests/services/`, `tests/utils/`, `tests/bot/handlers/`
- **Особенности**: Используют моки для внешних зависимостей

### 2. Integration тесты (Интеграционные тесты)
- **Цель**: Тестирование взаимодействия между компонентами
- **Расположение**: `tests/integration/`
- **Особенности**: Тестируют полные сценарии использования

## Настройка тестовой среды

### Переменные окружения
Тесты используют файл `.env.test` с тестовыми конфигурациями:

```env
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5432/test_db
REDIS_URL=redis://localhost:6379/1
OPENROUTER_API_KEY=test-api-key
TELEGRAM_BOT_TOKEN=test-bot-token
```

### Моки
Все внешние зависимости замокированы в `tests/setup.ts`:
- Prisma Client
- Redis
- Axios
- Telegraf
- Winston Logger

## Запуск тестов

### Все тесты
```bash
npm test
```

### Тесты в режиме наблюдения
```bash
npm run test:watch
```

### Тесты с покрытием кода
```bash
npm run test:coverage
```

### Конкретный тест
```bash
npm test -- tests/services/database.test.ts
```

### Тесты по паттерну
```bash
npm test -- --testNamePattern="должен создать пользователя"
```

## Покрытие кода

Цели покрытия:
- **Строки**: > 80%
- **Функции**: > 80%
- **Ветки**: > 75%
- **Операторы**: > 80%

Отчет о покрытии генерируется в папке `coverage/`.

## Написание тестов

### Структура теста
```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Настройка перед каждым тестом
  });

  afterEach(() => {
    // Очистка после каждого теста
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('должен выполнить ожидаемое действие', async () => {
      // Arrange (Подготовка)
      const input = 'test input';
      const expectedOutput = 'expected output';
      
      // Act (Действие)
      const result = await methodName(input);
      
      // Assert (Проверка)
      expect(result).toBe(expectedOutput);
    });
  });
});
```

### Лучшие практики

1. **Именование тестов**: Используйте описательные имена на русском языке
   ```typescript
   it('должен создать пользователя с валидными данными', () => {});
   ```

2. **Группировка**: Группируйте связанные тесты в `describe` блоки
   ```typescript
   describe('createUser', () => {
     describe('с валидными данными', () => {});
     describe('с невалидными данными', () => {});
   });
   ```

3. **Моки**: Всегда очищайте моки после тестов
   ```typescript
   afterEach(() => {
     jest.clearAllMocks();
   });
   ```

4. **Асинхронные тесты**: Используйте async/await
   ```typescript
   it('должен обработать асинхронную операцию', async () => {
     const result = await asyncFunction();
     expect(result).toBeDefined();
   });
   ```

## Тестирование компонентов

### Сервисы
- Тестируйте все публичные методы
- Мокайте внешние зависимости
- Проверяйте обработку ошибок

### Обработчики бота
- Тестируйте различные сценарии пользователей
- Проверяйте корректность ответов
- Тестируйте обработку ошибок

### Утилиты
- Тестируйте чистые функции
- Проверяйте граничные случаи
- Тестируйте различные входные данные

## Отладка тестов

### Запуск одного теста
```bash
npm test -- --testNamePattern="конкретный тест"
```

### Подробный вывод
```bash
npm test -- --verbose
```

### Отладка в VS Code
1. Установите точку останова
2. Запустите "Debug Jest Tests" в VS Code
3. Выберите нужный тест

## CI/CD

Тесты автоматически запускаются при:
- Push в основную ветку
- Создании Pull Request
- Релизе

### GitHub Actions
```yaml
- name: Run tests
  run: npm test

- name: Upload coverage
  run: npm run test:coverage
```

## Производительность тестов

### Оптимизация
- Используйте `beforeAll` для дорогих операций настройки
- Группируйте связанные тесты
- Избегайте реальных сетевых запросов

### Параллельное выполнение
Jest автоматически запускает тесты параллельно. Для настройки:
```bash
npm test -- --maxWorkers=4
```

## Troubleshooting

### Частые проблемы

1. **Тесты не находят модули**
   - Проверьте пути в `jest.config.js`
   - Убедитесь, что `moduleNameMapping` настроен правильно

2. **Моки не работают**
   - Проверьте порядок импортов
   - Убедитесь, что моки объявлены до импорта модулей

3. **Асинхронные тесты падают**
   - Используйте `async/await`
   - Увеличьте `testTimeout` в конфигурации

4. **Проблемы с TypeScript**
   - Проверьте `tsconfig.json`
   - Убедитесь, что типы Jest установлены

### Полезные команды

```bash
# Очистка кеша Jest
npm test -- --clearCache

# Обновление снимков
npm test -- --updateSnapshot

# Запуск только измененных тестов
npm test -- --onlyChanged

# Запуск тестов с покрытием для конкретного файла
npm test -- --coverage --collectCoverageFrom="src/services/database.ts"
```

## Ресурсы

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [TypeScript Jest](https://kulshekhar.github.io/ts-jest/)
