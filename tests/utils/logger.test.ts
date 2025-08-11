import winston from 'winston';

// Мокаем winston
jest.mock('winston', () => ({
  createLogger: jest.fn(),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Мокаем winston-daily-rotate-file
jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    name: 'DailyRotateFile',
  }));
});

describe('Logger', () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    (winston.createLogger as jest.Mock).mockReturnValue(mockLogger);

    // Очищаем require cache для переинициализации логгера
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен создать основной логгер', () => {
    require('../../src/utils/logger');

    expect(winston.createLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        format: expect.anything(),
        transports: expect.any(Array),
      })
    );
  });

  it('должен создать логгер базы данных', () => {
    require('../../src/utils/logger');

    // Проверяем, что createLogger был вызван несколько раз (для разных логгеров)
    expect(winston.createLogger).toHaveBeenCalledTimes(3); // logger, dbLogger, apiLogger
  });

  it('должен создать API логгер', () => {
    require('../../src/utils/logger');

    expect(winston.createLogger).toHaveBeenCalledTimes(3);
  });

  it('должен использовать debug уровень в development режиме', () => {
    process.env.NODE_ENV = 'development';
    
    require('../../src/utils/logger');

    expect(winston.createLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'debug',
      })
    );
  });

  it('должен использовать info уровень в production режиме', () => {
    process.env.NODE_ENV = 'production';
    
    require('../../src/utils/logger');

    expect(winston.createLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
      })
    );
  });

  it('должен экспортировать все логгеры', () => {
    const loggerModule = require('../../src/utils/logger');

    expect(loggerModule.logger).toBeDefined();
    expect(loggerModule.dbLogger).toBeDefined();
    expect(loggerModule.apiLogger).toBeDefined();
  });

  it('должен настроить форматирование логов', () => {
    require('../../src/utils/logger');

    expect(winston.format.combine).toHaveBeenCalled();
    expect(winston.format.timestamp).toHaveBeenCalled();
    expect(winston.format.errors).toHaveBeenCalledWith({ stack: true });
  });

  it('должен настроить транспорты для консоли и файлов', () => {
    require('../../src/utils/logger');

    expect(winston.transports.Console).toHaveBeenCalled();
    // DailyRotateFile должен быть вызван для файловых транспортов
  });

  describe('методы логирования', () => {
    let logger: any;

    beforeEach(() => {
      const loggerModule = require('../../src/utils/logger');
      logger = loggerModule.logger;
    });

    it('должен логировать info сообщения', () => {
      logger.info('Test info message', { data: 'test' });

      expect(mockLogger.info).toHaveBeenCalledWith('Test info message', { data: 'test' });
    });

    it('должен логировать error сообщения', () => {
      const error = new Error('Test error');
      logger.error('Test error message', error);

      expect(mockLogger.error).toHaveBeenCalledWith('Test error message', error);
    });

    it('должен логировать warn сообщения', () => {
      logger.warn('Test warning message');

      expect(mockLogger.warn).toHaveBeenCalledWith('Test warning message');
    });

    it('должен логировать debug сообщения', () => {
      logger.debug('Test debug message', { debug: true });

      expect(mockLogger.debug).toHaveBeenCalledWith('Test debug message', { debug: true });
    });
  });

  describe('специализированные логгеры', () => {
    let dbLogger: any;
    let apiLogger: any;

    beforeEach(() => {
      const loggerModule = require('../../src/utils/logger');
      dbLogger = loggerModule.dbLogger;
      apiLogger = loggerModule.apiLogger;
    });

    it('dbLogger должен логировать сообщения базы данных', () => {
      dbLogger.info('Database connection established');

      expect(mockLogger.info).toHaveBeenCalledWith('Database connection established');
    });

    it('apiLogger должен логировать API сообщения', () => {
      apiLogger.error('API request failed', { status: 500 });

      expect(mockLogger.error).toHaveBeenCalledWith('API request failed', { status: 500 });
    });
  });

  describe('обработка ошибок', () => {
    let logger: any;

    beforeEach(() => {
      const loggerModule = require('../../src/utils/logger');
      logger = loggerModule.logger;
    });

    it('должен обрабатывать объекты Error', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      logger.error('Error occurred', error);

      expect(mockLogger.error).toHaveBeenCalledWith('Error occurred', error);
    });

    it('должен обрабатывать строковые ошибки', () => {
      logger.error('String error message');

      expect(mockLogger.error).toHaveBeenCalledWith('String error message');
    });

    it('должен обрабатывать объекты с дополнительными данными', () => {
      const errorData = {
        message: 'Custom error',
        code: 'ERR_001',
        details: { userId: '123' },
      };

      logger.error('Custom error occurred', errorData);

      expect(mockLogger.error).toHaveBeenCalledWith('Custom error occurred', errorData);
    });
  });

  describe('конфигурация в разных окружениях', () => {
    it('должен включать цветной вывод в development', () => {
      process.env.NODE_ENV = 'development';
      
      require('../../src/utils/logger');

      expect(winston.format.colorize).toHaveBeenCalled();
    });

    it('должен использовать JSON формат в production', () => {
      process.env.NODE_ENV = 'production';
      
      require('../../src/utils/logger');

      expect(winston.format.json).toHaveBeenCalled();
    });

    it('должен создавать файловые транспорты в production', () => {
      process.env.NODE_ENV = 'production';
      
      require('../../src/utils/logger');

      // Проверяем, что DailyRotateFile был использован
      const DailyRotateFile = require('winston-daily-rotate-file');
      expect(DailyRotateFile).toHaveBeenCalled();
    });
  });

  describe('метаданные логирования', () => {
    let logger: any;

    beforeEach(() => {
      const loggerModule = require('../../src/utils/logger');
      logger = loggerModule.logger;
    });

    it('должен включать timestamp в логи', () => {
      require('../../src/utils/logger');

      expect(winston.format.timestamp).toHaveBeenCalled();
    });

    it('должен обрабатывать стек ошибок', () => {
      require('../../src/utils/logger');

      expect(winston.format.errors).toHaveBeenCalledWith({ stack: true });
    });

    it('должен логировать с дополнительными метаданными', () => {
      const metadata = {
        userId: '123',
        action: 'login',
        ip: '192.168.1.1',
      };

      logger.info('User logged in', metadata);

      expect(mockLogger.info).toHaveBeenCalledWith('User logged in', metadata);
    });
  });
});
