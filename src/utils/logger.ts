import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logLevel = process.env['LOG_LEVEL'] || 'info';
const nodeEnv = process.env['NODE_ENV'] || 'development';

// Форматирование логов
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Безопасная сериализация объектов с циклическими ссылками
const safeStringify = (obj: unknown): string => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, val: unknown) => {
    if (val != null && typeof val === 'object') {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }
    return val;
  });
};

// Форматирование для консоли в development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.printf(info => {
    const { timestamp, level, message, ...meta } = info;
    let msg = `${String(timestamp)} [${String(level)}]: ${String(message)}`;
    if (Object.keys(meta).length > 0) {
      try {
        msg += ` ${safeStringify(meta)}`;
      } catch (error) {
        msg += ` [Error serializing metadata: ${error instanceof Error ? error.message : 'Unknown error'}]`;
      }
    }
    return msg;
  })
);

// Транспорты для логов
const transports: winston.transport[] = [];

// Консольный вывод
if (nodeEnv === 'development') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: logLevel,
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      format: logFormat,
      level: logLevel,
    })
  );
}

// Файловые логи для production
if (nodeEnv === 'production') {
  // Общие логи
  transports.push(
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
      level: 'info',
    })
  );

  // Логи ошибок
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat,
      level: 'error',
    })
  );
}

// Создание логгера
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Добавление методов для специфичных типов логов
export const botLogger = logger.child({ service: 'telegram-bot' });
export const dbLogger = logger.child({ service: 'database' });
export const apiLogger = logger.child({ service: 'openrouter-api' });
export const redisLogger = logger.child({ service: 'redis' });

// Логирование необработанных исключений
if (nodeEnv === 'production') {
  logger.exceptions.handle(
    new DailyRotateFile({
      filename: 'logs/exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat,
    })
  );

  logger.rejections.handle(
    new DailyRotateFile({
      filename: 'logs/rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat,
    })
  );
}

export default logger;
