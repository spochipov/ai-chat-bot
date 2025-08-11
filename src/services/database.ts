import { PrismaClient } from '@prisma/client';
import { dbLogger } from '../utils/logger';

class DatabaseService {
  private static instance: DatabaseService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient({
      log: ['info', 'warn', 'error'],
      errorFormat: 'pretty',
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public static async initialize(): Promise<void> {
    const instance = DatabaseService.getInstance();
    try {
      await instance.prisma.$connect();
      dbLogger.info('Database connected successfully');
    } catch (error) {
      dbLogger.error('Failed to connect to database', error);
      throw error;
    }
  }

  public static async disconnect(): Promise<void> {
    const instance = DatabaseService.getInstance();
    try {
      await instance.prisma.$disconnect();
      dbLogger.info('Database disconnected successfully');
    } catch (error) {
      dbLogger.error('Failed to disconnect from database', error);
      throw error;
    }
  }

  public static getClient(): PrismaClient {
    return DatabaseService.getInstance().prisma;
  }

  // Методы для работы с пользователями
  public static async createUser(data: {
    telegramId: bigint;
    username?: string;
    firstName?: string;
    lastName?: string;
    accessKeyId: string;
    isAdmin?: boolean;
  }) {
    const client = DatabaseService.getClient();
    return client.user.create({
      data,
      include: {
        accessKey: true,
      },
    });
  }

  public static async findUserByTelegramId(telegramId: bigint) {
    const client = DatabaseService.getClient();
    return client.user.findUnique({
      where: { telegramId },
      include: {
        accessKey: true,
      },
    });
  }

  public static async updateUser(
    id: string,
    data: {
      username?: string;
      firstName?: string;
      lastName?: string;
      isActive?: boolean;
    }
  ) {
    const client = DatabaseService.getClient();
    return client.user.update({
      where: { id },
      data,
    });
  }

  // Методы для работы с ключами доступа
  public static async createAccessKey(data: {
    key: string;
    createdBy: string;
  }) {
    const client = DatabaseService.getClient();
    return client.accessKey.create({
      data,
    });
  }

  public static async findAccessKeyByKey(key: string) {
    const client = DatabaseService.getClient();
    return client.accessKey.findUnique({
      where: { key },
    });
  }

  public static async updateAccessKey(
    id: string,
    data: {
      isActive?: boolean;
      usedAt?: Date;
    }
  ) {
    const client = DatabaseService.getClient();
    return client.accessKey.update({
      where: { id },
      data,
    });
  }

  public static async getAllAccessKeys() {
    const client = DatabaseService.getClient();
    return client.accessKey.findMany({
      include: {
        users: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Методы для работы с сообщениями
  public static async createMessage(data: {
    userId: string;
    content: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM';
    tokens?: number;
    cost?: number;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    messageId?: number;
  }) {
    const client = DatabaseService.getClient();
    return client.message.create({
      data,
    });
  }

  public static async getUserMessages(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    const client = DatabaseService.getClient();
    return client.message.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  public static async clearUserMessages(userId: string) {
    const client = DatabaseService.getClient();
    return client.message.deleteMany({
      where: { userId },
    });
  }

  // Методы для работы с использованием
  public static async createUsage(data: {
    userId: string;
    tokens: number;
    cost: number;
    model: string;
    requestType: string;
  }) {
    const client = DatabaseService.getClient();
    return client.usage.create({
      data,
    });
  }

  public static async getUserUsage(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const client = DatabaseService.getClient();
    const where: any = { userId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    return client.usage.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  public static async getTotalUsage(startDate?: Date, endDate?: Date) {
    const client = DatabaseService.getClient();
    const where: any = {};

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    return client.usage.aggregate({
      where,
      _sum: {
        tokens: true,
        cost: true,
      },
      _count: {
        id: true,
      },
    });
  }

  // Методы для работы с настройками
  public static async getSetting(key: string) {
    const client = DatabaseService.getClient();
    return client.settings.findUnique({
      where: { key },
    });
  }

  public static async setSetting(
    key: string,
    value: string,
    description?: string
  ) {
    const client = DatabaseService.getClient();
    return client.settings.upsert({
      where: { key },
      update: { value, description: description || null },
      create: { key, value, description: description || null },
    });
  }

  // Методы для аналитики
  public static async getActiveUsersCount(days: number = 30) {
    const client = DatabaseService.getClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return client.user.count({
      where: {
        isActive: true,
        messages: {
          some: {
            createdAt: {
              gte: startDate,
            },
          },
        },
      },
    });
  }

  public static async getAllUsers() {
    const client = DatabaseService.getClient();
    return client.user.findMany({
      include: {
        accessKey: true,
        _count: {
          select: {
            messages: true,
            usage: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

export { DatabaseService };
