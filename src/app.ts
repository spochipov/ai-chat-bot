import dotenv from 'dotenv';
import { bot } from './bot';
import { logger } from './utils/logger';
import { DatabaseService } from './services/database';
import { RedisService } from './services/redis';
import express from 'express';

// Загрузка переменных окружения
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware для health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

async function startApplication() {
  try {
    logger.info('Starting AI Chat Bot application...');

    // Инициализация базы данных
    await DatabaseService.initialize();
    logger.info('Database connection established');

    // Инициализация Redis
    await RedisService.initialize();
    logger.info('Redis connection established');

    // Запуск Telegram бота
    await bot.launch();
    logger.info('Telegram bot started successfully');

    // Запуск HTTP сервера для health checks
    app.listen(PORT, () => {
      logger.info(`HTTP server is running on port ${PORT}`);
    });

    logger.info('Application started successfully');
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  try {
    bot.stop('SIGINT');
    await DatabaseService.disconnect();
    await RedisService.disconnect();
    logger.info('Application shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.once('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  try {
    bot.stop('SIGTERM');
    await DatabaseService.disconnect();
    await RedisService.disconnect();
    logger.info('Application shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Запуск приложения
startApplication().catch(error => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});
