import { DatabaseService } from '../../src/services/database';
import { PrismaClient } from '@prisma/client';

// Мокаем PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    accessKey: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    usage: {
      create: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    settings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  })),
}));

describe('DatabaseService', () => {
  let mockPrismaClient: any;

  beforeEach(() => {
    // Получаем мок PrismaClient
    mockPrismaClient = new (PrismaClient as jest.MockedClass<typeof PrismaClient>)();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('должен успешно подключиться к базе данных', async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);

      await expect(DatabaseService.initialize()).resolves.not.toThrow();
      expect(mockPrismaClient.$connect).toHaveBeenCalledTimes(1);
    });

    it('должен выбросить ошибку при неудачном подключении', async () => {
      const error = new Error('Connection failed');
      mockPrismaClient.$connect.mockRejectedValue(error);

      await expect(DatabaseService.initialize()).rejects.toThrow('Connection failed');
      expect(mockPrismaClient.$connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect', () => {
    it('должен успешно отключиться от базы данных', async () => {
      mockPrismaClient.$disconnect.mockResolvedValue(undefined);

      await expect(DatabaseService.disconnect()).resolves.not.toThrow();
      expect(mockPrismaClient.$disconnect).toHaveBeenCalledTimes(1);
    });

    it('должен выбросить ошибку при неудачном отключении', async () => {
      const error = new Error('Disconnect failed');
      mockPrismaClient.$disconnect.mockRejectedValue(error);

      await expect(DatabaseService.disconnect()).rejects.toThrow('Disconnect failed');
      expect(mockPrismaClient.$disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('createUser', () => {
    it('должен создать нового пользователя', async () => {
      const userData = {
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        accessKeyId: 'key-123',
        isAdmin: false,
      };

      const expectedUser = {
        id: 'user-123',
        ...userData,
        accessKey: { id: 'key-123', key: 'ACK_test', isActive: true },
      };

      mockPrismaClient.user.create.mockResolvedValue(expectedUser as any);

      const result = await DatabaseService.createUser(userData);

      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: userData,
        include: {
          accessKey: true,
        },
      });
      expect(result).toEqual(expectedUser);
    });
  });

  describe('findUserByTelegramId', () => {
    it('должен найти пользователя по Telegram ID', async () => {
      const telegramId = BigInt(123456789);
      const expectedUser = {
        id: 'user-123',
        telegramId,
        username: 'testuser',
        accessKey: { id: 'key-123', key: 'ACK_test', isActive: true },
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(expectedUser as any);

      const result = await DatabaseService.findUserByTelegramId(telegramId);

      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId },
        include: {
          accessKey: true,
        },
      });
      expect(result).toEqual(expectedUser);
    });

    it('должен вернуть null если пользователь не найден', async () => {
      const telegramId = BigInt(123456789);
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const result = await DatabaseService.findUserByTelegramId(telegramId);

      expect(result).toBeNull();
    });
  });

  describe('createAccessKey', () => {
    it('должен создать новый ключ доступа', async () => {
      const keyData = {
        key: 'ACK_test_key_123456789012345678901234',
        createdBy: 'admin-123',
      };

      const expectedKey = {
        id: 'key-123',
        ...keyData,
        isActive: true,
        createdAt: new Date(),
      };

      mockPrismaClient.accessKey.create.mockResolvedValue(expectedKey as any);

      const result = await DatabaseService.createAccessKey(keyData);

      expect(mockPrismaClient.accessKey.create).toHaveBeenCalledWith({
        data: keyData,
      });
      expect(result).toEqual(expectedKey);
    });
  });

  describe('findAccessKeyByKey', () => {
    it('должен найти ключ доступа по значению ключа', async () => {
      const key = 'ACK_test_key_123456789012345678901234';
      const expectedKey = {
        id: 'key-123',
        key,
        isActive: true,
        createdAt: new Date(),
      };

      mockPrismaClient.accessKey.findUnique.mockResolvedValue(expectedKey as any);

      const result = await DatabaseService.findAccessKeyByKey(key);

      expect(mockPrismaClient.accessKey.findUnique).toHaveBeenCalledWith({
        where: { key },
      });
      expect(result).toEqual(expectedKey);
    });
  });

  describe('createMessage', () => {
    it('должен создать новое сообщение', async () => {
      const messageData = {
        userId: 'user-123',
        content: 'Test message',
        role: 'USER' as const,
        tokens: 10,
        cost: 0.001,
      };

      const expectedMessage = {
        id: 'message-123',
        ...messageData,
        createdAt: new Date(),
      };

      mockPrismaClient.message.create.mockResolvedValue(expectedMessage as any);

      const result = await DatabaseService.createMessage(messageData);

      expect(mockPrismaClient.message.create).toHaveBeenCalledWith({
        data: messageData,
      });
      expect(result).toEqual(expectedMessage);
    });
  });

  describe('getUserMessages', () => {
    it('должен получить сообщения пользователя с лимитом по умолчанию', async () => {
      const userId = 'user-123';
      const expectedMessages = [
        { id: 'msg-1', content: 'Message 1', role: 'USER' },
        { id: 'msg-2', content: 'Message 2', role: 'ASSISTANT' },
      ];

      mockPrismaClient.message.findMany.mockResolvedValue(expectedMessages as any);

      const result = await DatabaseService.getUserMessages(userId);

      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual(expectedMessages);
    });

    it('должен получить сообщения пользователя с кастомным лимитом и смещением', async () => {
      const userId = 'user-123';
      const limit = 10;
      const offset = 20;

      await DatabaseService.getUserMessages(userId, limit, offset);

      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });
    });
  });

  describe('createUsage', () => {
    it('должен создать запись об использовании', async () => {
      const usageData = {
        userId: 'user-123',
        tokens: 100,
        cost: 0.01,
        model: 'gpt-4',
        requestType: 'chat',
      };

      const expectedUsage = {
        id: 'usage-123',
        ...usageData,
        date: new Date(),
      };

      mockPrismaClient.usage.create.mockResolvedValue(expectedUsage as any);

      const result = await DatabaseService.createUsage(usageData);

      expect(mockPrismaClient.usage.create).toHaveBeenCalledWith({
        data: usageData,
      });
      expect(result).toEqual(expectedUsage);
    });
  });

  describe('getTotalUsage', () => {
    it('должен получить общую статистику использования', async () => {
      const expectedStats = {
        _sum: {
          tokens: 1000,
          cost: 0.1,
        },
        _count: {
          id: 50,
        },
      };

      mockPrismaClient.usage.aggregate.mockResolvedValue(expectedStats as any);

      const result = await DatabaseService.getTotalUsage();

      expect(mockPrismaClient.usage.aggregate).toHaveBeenCalledWith({
        where: {},
        _sum: {
          tokens: true,
          cost: true,
        },
        _count: {
          id: true,
        },
      });
      expect(result).toEqual(expectedStats);
    });

    it('должен получить статистику за период', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await DatabaseService.getTotalUsage(startDate, endDate);

      expect(mockPrismaClient.usage.aggregate).toHaveBeenCalledWith({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: {
          tokens: true,
          cost: true,
        },
        _count: {
          id: true,
        },
      });
    });
  });

  describe('setSetting', () => {
    it('должен создать или обновить настройку', async () => {
      const key = 'test_setting';
      const value = 'test_value';
      const description = 'Test setting description';

      const expectedSetting = {
        id: 'setting-123',
        key,
        value,
        description,
      };

      mockPrismaClient.settings.upsert.mockResolvedValue(expectedSetting as any);

      const result = await DatabaseService.setSetting(key, value, description);

      expect(mockPrismaClient.settings.upsert).toHaveBeenCalledWith({
        where: { key },
        update: { value, description },
        create: { key, value, description },
      });
      expect(result).toEqual(expectedSetting);
    });
  });

  describe('getSetting', () => {
    it('должен получить настройку по ключу', async () => {
      const key = 'test_setting';
      const expectedSetting = {
        id: 'setting-123',
        key,
        value: 'test_value',
        description: 'Test setting',
      };

      mockPrismaClient.settings.findUnique.mockResolvedValue(expectedSetting as any);

      const result = await DatabaseService.getSetting(key);

      expect(mockPrismaClient.settings.findUnique).toHaveBeenCalledWith({
        where: { key },
      });
      expect(result).toEqual(expectedSetting);
    });
  });
});
