import { DatabaseService } from '../../src/services/database';
import { OpenRouterService } from '../../src/services/openrouter';
import { startHandler } from '../../src/bot/handlers/start';
import { BotContext } from '../../src/bot/middleware/auth';

// Мокаем внешние зависимости
jest.mock('../../src/services/database');
jest.mock('../../src/services/openrouter');

const mockedDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;
const mockedOpenRouterService = OpenRouterService as jest.Mocked<typeof OpenRouterService>;

describe('Bot Integration Tests', () => {
  let mockCtx: Partial<BotContext>;

  beforeEach(() => {
    mockCtx = {
      from: {
        id: 123456789,
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        is_bot: false,
        language_code: 'ru',
      },
      reply: jest.fn(),
      session: {
        awaitingAccessKey: false,
        user: undefined,
      },
      awaitingAccessKey: false,
      user: undefined,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Полный цикл регистрации пользователя', () => {
    it('должен успешно зарегистрировать нового пользователя', async () => {
      // Настройка: новый пользователь
      mockedDatabaseService.findUserByTelegramId.mockResolvedValue(null);

      // Действие: запуск команды /start
      await startHandler(mockCtx as BotContext);

      // Проверка: показаны варианты регистрации
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🔐 <b>Добро пожаловать в AI чат-бот!</b>'),
        expect.objectContaining({
          parse_mode: 'HTML',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🔑 Ввести ключ доступа',
                  callback_data: 'enter_access_key',
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('должен обработать существующего пользователя с активным ключом', async () => {
      // Настройка: существующий активный пользователь
      const existingUser = {
        id: 'user-123',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        isActive: true,
        isAdmin: false,
        accessKey: {
          id: 'key-123',
          isActive: true,
        },
      };

      mockedDatabaseService.findUserByTelegramId.mockResolvedValue(existingUser as any);

      // Действие: запуск команды /start
      await startHandler(mockCtx as BotContext);

      // Проверка: приветствие существующего пользователя
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('👋 Добро пожаловать обратно, Test!'),
        { parse_mode: 'Markdown' }
      );
    });
  });

  describe('Интеграция с OpenRouter', () => {
    it('должен успешно отправить сообщение через OpenRouter', async () => {
      const messages = [
        { role: 'user' as const, content: 'Hello, world!' },
      ];

      const mockResponse = {
        content: 'Hello! How can I help you today?',
        usage: {
          promptTokens: 9,
          completionTokens: 12,
          totalTokens: 21,
        },
        model: 'openai/gpt-4',
      };

      mockedOpenRouterService.sendMessage.mockResolvedValue(mockResponse);

      const result = await OpenRouterService.sendMessage(messages);

      expect(result).toEqual(mockResponse);
      expect(mockedOpenRouterService.sendMessage).toHaveBeenCalledWith(messages);
    });

    it('должен обработать ошибку OpenRouter API', async () => {
      const messages = [
        { role: 'user' as const, content: 'Test message' },
      ];

      mockedOpenRouterService.sendMessage.mockRejectedValue(
        new Error('OpenRouter API error')
      );

      await expect(OpenRouterService.sendMessage(messages)).rejects.toThrow(
        'OpenRouter API error'
      );
    });
  });

  describe('Интеграция с базой данных', () => {
    it('должен создать пользователя и сохранить сообщение', async () => {
      const userData = {
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        accessKeyId: 'key-123',
        isAdmin: false,
      };

      const createdUser = {
        id: 'user-123',
        ...userData,
      };

      const messageData = {
        userId: 'user-123',
        content: 'Test message',
        role: 'USER' as const,
        tokens: 10,
        cost: 0.001,
      };

      const createdMessage = {
        id: 'message-123',
        ...messageData,
        createdAt: new Date(),
      };

      mockedDatabaseService.createUser.mockResolvedValue(createdUser as any);
      mockedDatabaseService.createMessage.mockResolvedValue(createdMessage as any);

      // Создание пользователя
      const user = await DatabaseService.createUser(userData);
      expect(user).toEqual(createdUser);

      // Создание сообщения
      const message = await DatabaseService.createMessage(messageData);
      expect(message).toEqual(createdMessage);

      expect(mockedDatabaseService.createUser).toHaveBeenCalledWith(userData);
      expect(mockedDatabaseService.createMessage).toHaveBeenCalledWith(messageData);
    });

    it('должен получить историю сообщений пользователя', async () => {
      const userId = 'user-123';
      const expectedMessages = [
        {
          id: 'msg-1',
          content: 'Hello',
          role: 'USER',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg-2',
          content: 'Hi there!',
          role: 'ASSISTANT',
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
      ];

      mockedDatabaseService.getUserMessages.mockResolvedValue(expectedMessages as any);

      const messages = await DatabaseService.getUserMessages(userId);

      expect(messages).toEqual(expectedMessages);
      expect(mockedDatabaseService.getUserMessages).toHaveBeenCalledWith(userId);
    });
  });

  describe('Обработка ошибок в интеграции', () => {
    it('должен обработать ошибку базы данных при регистрации', async () => {
      mockedDatabaseService.findUserByTelegramId.mockRejectedValue(
        new Error('Database connection failed')
      );

      await startHandler(mockCtx as BotContext);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Произошла ошибка при запуске бота. Попробуйте еще раз позже.'
      );
    });

    it('должен обработать недоступность OpenRouter сервиса', async () => {
      mockedOpenRouterService.healthCheck.mockResolvedValue(false);

      const isHealthy = await OpenRouterService.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('Сценарии использования', () => {
    it('должен обработать полный сценарий чата', async () => {
      // 1. Пользователь существует и активен
      const user = {
        id: 'user-123',
        telegramId: BigInt(123456789),
        isActive: true,
        accessKey: { isActive: true },
      };

      mockedDatabaseService.findUserByTelegramId.mockResolvedValue(user as any);

      // 2. Получаем историю сообщений
      const messageHistory = [
        { content: 'Previous message', role: 'USER' },
      ];

      mockedDatabaseService.getUserMessages.mockResolvedValue(messageHistory as any);

      // 3. Отправляем сообщение в OpenRouter
      const openRouterResponse = {
        content: 'AI response',
        usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
        model: 'openai/gpt-4',
      };

      mockedOpenRouterService.sendMessage.mockResolvedValue(openRouterResponse);

      // 4. Сохраняем сообщения пользователя и ассистента
      mockedDatabaseService.createMessage.mockResolvedValue({} as any);
      mockedDatabaseService.createUsage.mockResolvedValue({} as any);

      // Выполнение сценария
      const foundUser = await DatabaseService.findUserByTelegramId(BigInt(123456789));
      expect(foundUser).toEqual(user);

      const history = await DatabaseService.getUserMessages('user-123');
      expect(history).toEqual(messageHistory);

      const aiResponse = await OpenRouterService.sendMessage([
        { role: 'user', content: 'New message' },
      ]);
      expect(aiResponse).toEqual(openRouterResponse);

      // Проверяем, что все методы были вызваны
      expect(mockedDatabaseService.findUserByTelegramId).toHaveBeenCalled();
      expect(mockedDatabaseService.getUserMessages).toHaveBeenCalled();
      expect(mockedOpenRouterService.sendMessage).toHaveBeenCalled();
    });

    it('должен обработать сценарий администратора', async () => {
      // Администратор запускает бота
      const adminUser = {
        id: 'admin-123',
        telegramId: BigInt(123456789),
        isActive: true,
        isAdmin: true,
        accessKey: { isActive: true },
      };

      mockedDatabaseService.findUserByTelegramId.mockResolvedValue(adminUser as any);

      await startHandler(mockCtx as BotContext);

      // Проверяем, что показаны команды администратора
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🔧 *Команды администратора:*'),
        { parse_mode: 'Markdown' }
      );
    });
  });

  describe('Производительность и нагрузка', () => {
    it('должен обработать множественные запросы к базе данных', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      const mockUsers = userIds.map(id => ({
        id,
        telegramId: BigInt(parseInt(id.split('-')[1]) + 123456789),
        isActive: true,
      }));

      // Мокаем параллельные запросы
      mockedDatabaseService.findUserByTelegramId
        .mockResolvedValueOnce(mockUsers[0] as any)
        .mockResolvedValueOnce(mockUsers[1] as any)
        .mockResolvedValueOnce(mockUsers[2] as any);

      // Выполняем параллельные запросы
      const promises = userIds.map((_, index) =>
        DatabaseService.findUserByTelegramId(BigInt(index + 123456790))
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockedDatabaseService.findUserByTelegramId).toHaveBeenCalledTimes(3);
    });

    it('должен обработать множественные запросы к OpenRouter', async () => {
      const messages = [
        [{ role: 'user' as const, content: 'Message 1' }],
        [{ role: 'user' as const, content: 'Message 2' }],
        [{ role: 'user' as const, content: 'Message 3' }],
      ];

      const mockResponses = messages.map((_, index) => ({
        content: `Response ${index + 1}`,
        usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
        model: 'openai/gpt-4',
      }));

      mockedOpenRouterService.sendMessage
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
        .mockResolvedValueOnce(mockResponses[2]);

      // Выполняем параллельные запросы
      const promises = messages.map(msg => OpenRouterService.sendMessage(msg));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0].content).toBe('Response 1');
      expect(results[1].content).toBe('Response 2');
      expect(results[2].content).toBe('Response 3');
    });
  });
});
