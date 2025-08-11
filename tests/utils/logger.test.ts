import { logger, dbLogger, apiLogger, botLogger, redisLogger } from '../../src/utils/logger';

describe('Logger', () => {
  describe('основная функциональность', () => {
    it('должен экспортировать основной логгер', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('должен экспортировать специализированные логгеры', () => {
      expect(dbLogger).toBeDefined();
      expect(apiLogger).toBeDefined();
      // botLogger и redisLogger замокированы в setup.ts
      // Их проверка выполняется в изолированном тесте
    });
  });

  describe('методы логирования', () => {
    it('должен логировать info сообщения', () => {
      // Проверяем, что метод существует и может быть вызван
      expect(() => {
        logger.info('Test info message', { data: 'test' });
      }).not.toThrow();
    });

    it('должен логировать error сообщения', () => {
      const error = new Error('Test error');
      expect(() => {
        logger.error('Test error message', error);
      }).not.toThrow();
    });

    it('должен логировать warn сообщения', () => {
      expect(() => {
        logger.warn('Test warning message');
      }).not.toThrow();
    });

    it('должен логировать debug сообщения', () => {
      expect(() => {
        logger.debug('Test debug message', { debug: true });
      }).not.toThrow();
    });
  });

  describe('специализированные логгеры', () => {
    it('dbLogger должен логировать сообщения базы данных', () => {
      expect(() => {
        dbLogger.info('Database connection established');
      }).not.toThrow();
    });

    it('apiLogger должен логировать API сообщения', () => {
      expect(() => {
        apiLogger.error('API request failed', { status: 500 });
      }).not.toThrow();
    });

    it('botLogger должен логировать сообщения бота', () => {
      expect(() => {
        botLogger.info('Bot message processed');
      }).not.toThrow();
    });

    it('redisLogger должен логировать сообщения Redis', () => {
      expect(() => {
        redisLogger.warn('Redis connection warning');
      }).not.toThrow();
    });
  });

  describe('обработка ошибок', () => {
    it('должен обрабатывать объекты Error', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      expect(() => {
        logger.error('Error occurred', error);
      }).not.toThrow();
    });

    it('должен обрабатывать строковые ошибки', () => {
      expect(() => {
        logger.error('String error message');
      }).not.toThrow();
    });

    it('должен обрабатывать объекты с дополнительными данными', () => {
      const errorData = {
        message: 'Custom error',
        code: 'ERR_001',
        details: { userId: '123' },
      };

      expect(() => {
        logger.error('Custom error occurred', errorData);
      }).not.toThrow();
    });
  });

  describe('конфигурация в разных окружениях', () => {
    it('должен работать в development режиме', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      expect(() => {
        logger.info('Development log message');
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });

    it('должен работать в production режиме', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      expect(() => {
        logger.info('Production log message');
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });

    it('должен работать в test режиме', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      expect(() => {
        logger.info('Test log message');
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('метаданные логирования', () => {
    it('должен логировать с дополнительными метаданными', () => {
      const metadata = {
        userId: '123',
        action: 'login',
        ip: '192.168.1.1',
      };

      expect(() => {
        logger.info('User logged in', metadata);
      }).not.toThrow();
    });

    it('должен обрабатывать циклические ссылки в метаданных', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // Создаем циклическую ссылку

      expect(() => {
        logger.info('Object with circular reference', obj);
      }).not.toThrow();
    });

    it('должен обрабатывать undefined и null значения', () => {
      expect(() => {
        logger.info('Message with undefined', undefined);
        logger.info('Message with null', null);
      }).not.toThrow();
    });
  });

  describe('уровни логирования', () => {
    it('должен поддерживать все стандартные уровни', () => {
      expect(() => {
        logger.error('Error level');
        logger.warn('Warn level');
        logger.info('Info level');
        logger.debug('Debug level');
      }).not.toThrow();
    });

    it('должен работать с пользовательским уровнем LOG_LEVEL', () => {
      const originalLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'debug';
      
      expect(() => {
        logger.debug('Debug message with custom level');
      }).not.toThrow();

      if (originalLevel !== undefined) {
        process.env.LOG_LEVEL = originalLevel;
      } else {
        delete process.env.LOG_LEVEL;
      }
    });
  });
});
