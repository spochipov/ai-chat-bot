import { Telegraf, Context, session } from 'telegraf';
import { botLogger } from '../utils/logger';
import {
  loadUserMiddleware,
  authMiddleware,
  adminMiddleware,
} from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { loggingMiddleware } from './middleware/logging';
import { errorHandler } from './middleware/errorHandler';

// Импорт обработчиков команд
import { startHandler } from './handlers/start';
import { helpHandler } from './handlers/help';
import { clearHandler } from './handlers/clear';
import { statusHandler } from './handlers/status';
import { messageHandler } from './handlers/message';
import { fileHandler } from './handlers/file';
import { audioHandler } from './handlers/audio';
import { forwardHandler } from './handlers/forward';

// Импорт админских обработчиков
import { adminHandler } from './handlers/admin';
import { callbackHandler } from './handlers/callback';
import { generateKeyHandler } from './handlers/generateKey';
import { listKeysHandler } from './handlers/listKeys';
import { deactivateKeyHandler } from './handlers/deactivateKey';
import { listUsersHandler } from './handlers/listUsers';
import { userStatsHandler } from './handlers/userStats';
import { balanceHandler } from './handlers/balance';
import { analyticsHandler } from './handlers/analytics';

// Расширение контекста Telegraf
interface BotContext extends Context {
  session: {
    user?: {
      id: string;
      telegramId: bigint;
      isAdmin: boolean;
      accessKeyId: string;
    };
    awaitingAccessKey?: boolean;
    awaitingKeyDeactivation?: boolean;
  };
}

// Создание экземпляра бота
const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  throw new Error('BOT_TOKEN is required');
}

const bot = new Telegraf<BotContext>(botToken);

// Настройка сессий
bot.use(
  session({
    defaultSession: () => ({
      awaitingAccessKey: false,
      awaitingKeyDeactivation: false,
    }),
  })
);

// Подключение middleware
bot.use(loggingMiddleware);
bot.use(errorHandler);
bot.use(rateLimitMiddleware);
bot.use(loadUserMiddleware); // Загружаем пользователя в контекст для всех запросов

// Команды, доступные без аутентификации
bot.start(startHandler);

// Команда help доступна всем (показывает разный контент в зависимости от статуса)
bot.help(helpHandler);

// Основные команды (требуют авторизации)
bot.command('clear', authMiddleware, clearHandler);
bot.command('status', authMiddleware, statusHandler);
bot.command('balance', authMiddleware, balanceHandler);

// Админские команды (требуют права администратора)
bot.command('admin', adminMiddleware, adminHandler);
bot.command('generate_key', adminMiddleware, generateKeyHandler);
bot.command('list_keys', adminMiddleware, listKeysHandler);
bot.command('deactivate_key', adminMiddleware, deactivateKeyHandler);
bot.command('list_users', adminMiddleware, listUsersHandler);
bot.command('user_stats', adminMiddleware, userStatsHandler);
bot.command('analytics', adminMiddleware, analyticsHandler);

// Обработка callback-запросов
bot.on('callback_query', callbackHandler);

// Обработка файлов
bot.on(['document', 'photo'], fileHandler);

// Обработка аудиосообщений
bot.on(['voice', 'audio'], audioHandler);

// Обработка пересылаемых сообщений (должна быть перед обработкой текста)
bot.use(async (ctx, next) => {
  if (
    ctx.message &&
    ('forward_from' in ctx.message || 'forward_from_chat' in ctx.message)
  ) {
    await forwardHandler(ctx as any);
    return;
  }
  return next();
});

// Обработка текстовых сообщений
bot.on('text', messageHandler);

// Обработка ошибок
bot.catch((err, ctx) => {
  botLogger.error('Bot error occurred', {
    error: err,
    userId: ctx.from?.id,
    chatId: ctx.chat?.id,
    updateType: ctx.updateType,
  });

  ctx
    .reply('Произошла ошибка при обработке вашего запроса. Попробуйте позже.')
    .catch(() => {
      botLogger.error('Failed to send error message to user');
    });
});

// Graceful shutdown
process.once('SIGINT', () => {
  botLogger.info('Received SIGINT, stopping bot...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  botLogger.info('Received SIGTERM, stopping bot...');
  bot.stop('SIGTERM');
});

export { bot, BotContext };
