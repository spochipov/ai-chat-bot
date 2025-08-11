import Redis from 'ioredis';
import { redisLogger } from '../utils/logger';

class RedisService {
  private static instance: RedisService;
  private client: Redis;

  private constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisPassword = process.env.REDIS_PASSWORD;

    const options: {
      enableReadyCheck: boolean;
      maxRetriesPerRequest: number;
      lazyConnect: boolean;
      password?: string;
    } = {
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    if (redisPassword) {
      options.password = redisPassword;
    }

    this.client = new Redis(redisUrl, options);

    // Обработка событий Redis
    this.client.on('connect', () => {
      redisLogger.info('Redis connection established');
    });

    this.client.on('ready', () => {
      redisLogger.info('Redis is ready to receive commands');
    });

    this.client.on('error', (error: Error) => {
      redisLogger.error('Redis connection error:', error);
    });

    this.client.on('close', () => {
      redisLogger.info('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      redisLogger.info('Redis reconnecting...');
    });
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public static async initialize(): Promise<void> {
    const instance = RedisService.getInstance();
    try {
      await instance.client.connect();
      redisLogger.info('Redis connected successfully');
    } catch (error) {
      redisLogger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  public static async disconnect(): Promise<void> {
    const instance = RedisService.getInstance();
    try {
      await instance.client.quit();
      redisLogger.info('Redis disconnected successfully');
    } catch (error) {
      redisLogger.error('Failed to disconnect from Redis:', error);
      throw error;
    }
  }

  public static getClient(): Redis {
    return RedisService.getInstance().client;
  }

  // Методы для работы с сессиями пользователей
  public static async setUserSession(
    userId: string,
    data: unknown,
    ttl: number = 86400
  ): Promise<void> {
    const client = RedisService.getClient();
    const key = `user_session:${userId}`;
    await client.setex(key, ttl, JSON.stringify(data));
  }

  public static async getUserSession(userId: string): Promise<unknown> {
    const client = RedisService.getClient();
    const key = `user_session:${userId}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  }

  public static async deleteUserSession(userId: string): Promise<void> {
    const client = RedisService.getClient();
    const key = `user_session:${userId}`;
    await client.del(key);
  }

  // Методы для работы с контекстом чата
  public static async setChatContext(
    userId: string,
    messages: unknown[],
    ttl: number = 3600
  ): Promise<void> {
    const client = RedisService.getClient();
    const key = `chat_context:${userId}`;
    await client.setex(key, ttl, JSON.stringify(messages));
  }

  public static async getChatContext(
    userId: string
  ): Promise<unknown[] | null> {
    const client = RedisService.getClient();
    const key = `chat_context:${userId}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  }

  public static async clearChatContext(userId: string): Promise<void> {
    const client = RedisService.getClient();
    const key = `chat_context:${userId}`;
    await client.del(key);
  }

  // Методы для rate limiting
  public static async checkRateLimit(
    userId: string,
    limit: number = 10,
    window: number = 60
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const client = RedisService.getClient();
    const key = `rate_limit:${userId}`;
    const now = Date.now();
    const windowStart = now - window * 1000;

    // Используем sorted set для хранения временных меток запросов
    await client.zremrangebyscore(key, 0, windowStart);
    const currentCount = await client.zcard(key);

    if (currentCount >= limit) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const oldestRequest: any = await client.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        oldestRequest.length > 0 && typeof oldestRequest[1] === 'string'
          ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            parseInt(oldestRequest[1]) + window * 1000
          : now + window * 1000;

      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    // Добавляем текущий запрос
    await client.zadd(key, now, now);
    await client.expire(key, window);

    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetTime: now + window * 1000,
    };
  }

  // Методы для кэширования
  public static async set(
    key: string,
    value: unknown,
    ttl?: number
  ): Promise<void> {
    const client = RedisService.getClient();
    const serializedValue = JSON.stringify(value);

    if (ttl) {
      await client.setex(key, ttl, serializedValue);
    } else {
      await client.set(key, serializedValue);
    }
  }

  public static async get(key: string): Promise<unknown> {
    const client = RedisService.getClient();
    const data = await client.get(key);
    if (data === null) {
      return null;
    }
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  public static async del(key: string): Promise<void> {
    const client = RedisService.getClient();
    await client.del(key);
  }

  public static async exists(key: string): Promise<boolean> {
    const client = RedisService.getClient();
    const result = await client.exists(key);
    return result === 1;
  }

  // Методы для работы с временными токенами
  public static async setTempToken(
    token: string,
    data: unknown,
    ttl: number = 300
  ): Promise<void> {
    const client = RedisService.getClient();
    const key = `temp_token:${token}`;
    await client.setex(key, ttl, JSON.stringify(data));
  }

  public static async getTempToken(token: string): Promise<unknown> {
    const client = RedisService.getClient();
    const key = `temp_token:${token}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  }

  public static async deleteTempToken(token: string): Promise<void> {
    const client = RedisService.getClient();
    const key = `temp_token:${token}`;
    await client.del(key);
  }

  // Методы для статистики
  public static async incrementCounter(
    key: string,
    increment: number = 1
  ): Promise<number> {
    const client = RedisService.getClient();
    return await client.incrby(key, increment);
  }

  public static async getCounter(key: string): Promise<number> {
    const client = RedisService.getClient();
    const value = await client.get(key);
    return value ? parseInt(value) : 0;
  }

  // Методы для работы с очередями (если понадобится)
  public static async pushToQueue(
    queueName: string,
    data: unknown
  ): Promise<void> {
    const client = RedisService.getClient();
    await client.lpush(queueName, JSON.stringify(data));
  }

  public static async popFromQueue(queueName: string): Promise<unknown> {
    const client = RedisService.getClient();
    const data = await client.rpop(queueName);
    return data ? JSON.parse(data) : null;
  }

  public static async getQueueLength(queueName: string): Promise<number> {
    const client = RedisService.getClient();
    return await client.llen(queueName);
  }

  // Утилитарные методы
  public static async ping(): Promise<string> {
    const client = RedisService.getClient();
    return await client.ping();
  }

  public static async flushAll(): Promise<void> {
    const client = RedisService.getClient();
    await client.flushall();
    redisLogger.warn('Redis: All data flushed');
  }

  public static async getKeys(pattern: string = '*'): Promise<string[]> {
    const client = RedisService.getClient();
    return await client.keys(pattern);
  }
}

export { RedisService };
