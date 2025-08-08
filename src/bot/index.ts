import { Telegraf, Context, session } from 'telegraf';
import { botLogger } from '../utils/logger';
import { authMiddleware } from './middleware/auth';
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

// Импорт админских обработчиков
import { adminHandler } from './handlers/admin';
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

// Команды, доступные без аутентификации
bot.start(startHandler);

// Middleware для аутентификации (применяется ко всем командам кроме /start)
bot.use(authMiddleware);

// Основные команды
bot.help(helpHandler);
bot.command('clear', clearHandler);
bot.command('status', statusHandler);

// Админские команды
bot.command('admin', adminHandler);
bot.command('generate_key', generateKeyHandler);
bot.command('list_keys', listKeysHandler);
bot.command('deactivate_key', deactivateKeyHandler);
bot.command('list_users', listUsersHandler);
bot.command('user_stats', userStatsHandler);
bot.command('balance', balanceHandler);
bot.command('analytics', analyticsHandler);

// Обработка файлов
bot.on(['document', 'photo'], fileHandler);

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
