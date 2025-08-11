import { startHandler, handleAccessKeyInput } from '../../../src/bot/handlers/start';
import { DatabaseService } from '../../../src/services/database';
import { BotContext } from '../../../src/bot/middleware/auth';

// Мокаем DatabaseService
jest.mock('../../../src/services/database');
const mockedDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

describe('Start Handler', () => {
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

  describe('startHandler', () => {
    it('должен приветствовать существующего активного пользователя', async () => {
      const existingUser = {
        id: 'user-123',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        isAdmin: false,
        accessKey: {
          id: 'key-123',
          key: 'ACK_test',
          isActive: true,
        },
      };

      mockedDatabaseService.findUserByTelegramId.mockResolvedValue(existingUser as any);

      await startHandler(mockCtx as BotContext);

      expect(mockedDatabaseService.findUserByTelegramId).toHaveBeenCalledWith(BigInt(123456789));
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('👋 Добро пожаловать обратно, Test!'),
        { parse_mode: 'Markdown' }
      );
    });

    it('должен приветствовать существующего администратора с дополнительными командами', async () => {
      const adminUser = {
        id: 'user-123',
        telegramId: BigInt(123456789),
        username: 'admin',
        firstName: 'Admin',
        isActive: true,
        isAdmin: true,
        accessKey: {
          id: 'key-123',
          key: 'ACK_admin',
          isActive: true,
        },
      };

      mockedDatabaseService.findUserByTelegramId.mockResolvedValue(adminUser as any);

      await startHandler(mockCtx as BotContext);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🔧 *Команды администратора:*'),
        { parse_mode: 'Markdown' }
      );
    });

    it('должен сообщить о деактивированном аккаунте', async () => {
      const deactivatedUser = {
        id: 'user-123',
        telegramId: BigInt(123456789),
        isActive: false,
        accessKey: {
          isActive: true,
        },
      };

      mockedDatabaseService.findUserByTelegramId.mockResolvedValue(deactivatedUser as any);

      await startHandler(mockCtx as BotContext);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Ваш аккаунт деактивирован. Обратитесь к администратору для восстановления доступа.'
      );
    });

    it('должен сообщить о деактивированном ключе доступа', async () => {
      const userWithInactiveKey = {
        id: 'user-123',
        telegramId: BigInt(123456789),
        isActive: true,
        accessKey: {
          isActive: false,
        },
      };

      mockedDatabaseService.findUserByTelegramId.mockResolvedValue(userWithInactiveKey as any);

      await startHandler(mockCtx as BotContext);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Ваш ключ доступа деактивирован. Обратитесь к администратору для получения нового ключа.'
      );
    });

    it('должен показать варианты регистрации для нового пользователя', async () => {
      mockedDatabaseService.findUserByTelegramId.mockResolvedValue(null);

      await startHandler(mockCtx as BotContext);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🔐 <b>Добро пожаловать в AI чат-бот!</b>'),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔑 Ввести ключ доступа',
                  callback_data: 'enter_access_key',
                },
              ],
              [
                {
                  text: '📨 Запросить доступ у администратора',
                  callback_data: 'request_access',
                },
              ],
              [
                {
                  text: '❓ Справка',
                  callback_data: 'access_help',
                },
              ],
            ],
          },
        }
      );
    });

    it('должен обработать ошибку базы данных', async () => {
      mockedDatabaseService.findUserByTelegramId.mockRejectedValue(new Error('Database error'));

      await startHandler(mockCtx as BotContext);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Произошла ошибка при запуске бота. Попробуйте еще раз позже.'
      );
    });
  });

  describe('handleAccessKeyInput', () => {
    beforeEach(() => {
      mockCtx.session = {
        awaitingAccessKey: true,
        user: undefined,
      };
      mockCtx.awaitingAccessKey = true;
    });

    it('должен успешно зарегистрировать пользователя с валидным ключом', async () => {
      const accessKey = 'ACK_test_key_123456789012345678901234';
      const foundKey = {
        id: 'key-123',
        key: accessKey,
        isActive: true,
        createdAt: new Date(),
      };

      const newUser = {
        id: 'user-123',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        accessKeyId: 'key-123',
        isAdmin: false,
      };

      mockedDatabaseService.findAccessKeyByKey.mockResolvedValue(foundKey as any);
      mockedDatabaseService.getClient.mockReturnValue({
        user: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      } as any);
      mockedDatabaseService.createUser.mockResolvedValue(newUser as any);
      mockedDatabaseService.updateAccessKey.mockResolvedValue({} as any);

      const result = await handleAccessKeyInput(mockCtx as BotContext, accessKey);

      expect(result).toBe(true);
      expect(mockedDatabaseService.findAccessKeyByKey).toHaveBeenCalledWith(accessKey);
      expect(mockedDatabaseService.createUser).toHaveBeenCalledWith({
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        accessKeyId: 'key-123',
        isAdmin: false,
      });
      expect(mockedDatabaseService.updateAccessKey).toHaveBeenCalledWith('key-123', {
        usedAt: expect.any(Date),
      });
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('✅ *Регистрация успешно завершена!*'),
        { parse_mode: 'Markdown' }
      );
      expect(mockCtx.session?.awaitingAccessKey).toBe(false);
      expect(mockCtx.awaitingAccessKey).toBe(false);
    });

    it('должен отклонить ключ с неверным форматом', async () => {
      const invalidKey = 'invalid_key';

      const result = await handleAccessKeyInput(mockCtx as BotContext, invalidKey);

      expect(result).toBe(false);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Неверный формат ключа доступа. Ключ должен начинаться с "ACK_" и содержать 36 символов.'
      );
    });

    it('должен отклонить несуществующий ключ', async () => {
      const accessKey = 'ACK_nonexistent_key_1234567890123456';
      mockedDatabaseService.findAccessKeyByKey.mockResolvedValue(null);

      const result = await handleAccessKeyInput(mockCtx as BotContext, accessKey);

      expect(result).toBe(false);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Ключ доступа не найден. Проверьте правильность ввода или обратитесь к администратору.'
      );
    });

    it('должен отклонить деактивированный ключ', async () => {
      const accessKey = 'ACK_inactive_key_123456789012345678';
      const inactiveKey = {
        id: 'key-123',
        key: accessKey,
        isActive: false,
      };

      mockedDatabaseService.findAccessKeyByKey.mockResolvedValue(inactiveKey as any);

      const result = await handleAccessKeyInput(mockCtx as BotContext, accessKey);

      expect(result).toBe(false);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Данный ключ доступа деактивирован. Обратитесь к администратору для получения нового ключа.'
      );
    });

    it('должен отклонить уже используемый ключ', async () => {
      const accessKey = 'ACK_used_key_1234567890123456789012';
      const usedKey = {
        id: 'key-123',
        key: accessKey,
        isActive: true,
      };

      const existingUser = {
        id: 'user-456',
        accessKeyId: 'key-123',
      };

      mockedDatabaseService.findAccessKeyByKey.mockResolvedValue(usedKey as any);
      mockedDatabaseService.getClient.mockReturnValue({
        user: {
          findFirst: jest.fn().mockResolvedValue(existingUser),
        },
      } as any);

      const result = await handleAccessKeyInput(mockCtx as BotContext, accessKey);

      expect(result).toBe(false);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Данный ключ доступа уже используется другим пользователем.'
      );
    });

    it('должен обработать ошибку при создании пользователя', async () => {
      const accessKey = 'ACK_test_key_123456789012345678901234';
      const foundKey = {
        id: 'key-123',
        key: accessKey,
        isActive: true,
      };

      mockedDatabaseService.findAccessKeyByKey.mockResolvedValue(foundKey as any);
      mockedDatabaseService.getClient.mockReturnValue({
        user: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      } as any);
      mockedDatabaseService.createUser.mockRejectedValue(new Error('Database error'));

      const result = await handleAccessKeyInput(mockCtx as BotContext, accessKey);

      expect(result).toBe(false);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Произошла ошибка при обработке ключа доступа. Попробуйте еще раз позже.'
      );
    });

    it('должен создать пользователя без опциональных полей', async () => {
      const accessKey = 'ACK_test_key_123456789012345678901234';
      const foundKey = {
        id: 'key-123',
        key: accessKey,
        isActive: true,
      };

      // Контекст без username, first_name, last_name
      const minimalCtx = {
        ...mockCtx,
        from: {
          id: 123456789,
          is_bot: false,
          language_code: 'ru',
        },
      };

      const newUser = {
        id: 'user-123',
        telegramId: BigInt(123456789),
        accessKeyId: 'key-123',
        isAdmin: false,
      };

      mockedDatabaseService.findAccessKeyByKey.mockResolvedValue(foundKey as any);
      mockedDatabaseService.getClient.mockReturnValue({
        user: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      } as any);
      mockedDatabaseService.createUser.mockResolvedValue(newUser as any);
      mockedDatabaseService.updateAccessKey.mockResolvedValue({} as any);

      const result = await handleAccessKeyInput(minimalCtx as BotContext, accessKey);

      expect(result).toBe(true);
      expect(mockedDatabaseService.createUser).toHaveBeenCalledWith({
        telegramId: BigInt(123456789),
        accessKeyId: 'key-123',
        isAdmin: false,
      });
    });
  });
});
