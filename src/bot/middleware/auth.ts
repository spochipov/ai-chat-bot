import { Context } from 'telegraf';
import { DatabaseService } from '../../services/database';
import { logger } from '../../utils/logger';

export interface BotContext extends Context {
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
  user?: {
    id: string;
    telegramId: bigint;
    isAdmin: boolean;
    accessKeyId: string;
  } | undefined;
  awaitingAccessKey?: boolean;
  awaitingKeyDeactivation?: boolean;
}

// Middleware для загрузки данных пользователя в контекст (применяется ко всем запросам)
export const loadUserMiddleware = async (ctx: BotContext, next: () => Promise<void>) => {
  try {
    // Синхронизируем данные из сессии с контекстом для удобства
    if (ctx.session.user) {
      ctx.user = ctx.session.user;
    }
    if (ctx.session.awaitingAccessKey !== undefined) {
      ctx.awaitingAccessKey = ctx.session.awaitingAccessKey;
    }
    if (ctx.session.awaitingKeyDeactivation !== undefined) {
      ctx.awaitingKeyDeactivation = ctx.session.awaitingKeyDeactivation;
    }

    // Если пользователь не в сессии, пытаемся найти его в базе данных
    if (!ctx.user && ctx.from) {
      const telegramId = BigInt(ctx.from.id);
      const user = await DatabaseService.findUserByTelegramId(telegramId);
      
      if (user && user.isActive && user.accessKey.isActive) {
        // Сохраняем пользователя в сессии
        ctx.session.user = {
          id: user.id,
          telegramId: user.telegramId,
          isAdmin: user.isAdmin,
          accessKeyId: user.accessKeyId
        };
        ctx.user = ctx.session.user;
        
        logger.info('User loaded into context', {
          userId: user.id,
          telegramId: telegramId.toString(),
          isAdmin: user.isAdmin
        });
      }
    }

    // Если пользователь найден, проверяем его актуальность
    if (ctx.user) {
      const currentUser = await DatabaseService.findUserByTelegramId(ctx.user.telegramId);
      if (!currentUser || !currentUser.isActive || !currentUser.accessKey.isActive) {
        // Сохраняем telegramId перед очисткой
        const telegramId = ctx.user.telegramId.toString();
        
        // Очищаем сессию если пользователь деактивирован
        delete ctx.session.user;
        ctx.user = undefined;
        
        logger.info('User deactivated, cleared from session', {
          telegramId
        });
      } else {
        // Обновляем данные пользователя в сессии, если они изменились
        if (ctx.session.user && currentUser.isAdmin !== ctx.user.isAdmin) {
          ctx.session.user.isAdmin = currentUser.isAdmin;
          ctx.user.isAdmin = currentUser.isAdmin;
        }
      }
    }

    return next();
    
  } catch (error) {
    logger.error('Error in loadUserMiddleware', {
      error: error instanceof Error ? error.message : 'Unknown error',
      telegramId: ctx.from?.id
    });
    
    // Продолжаем выполнение даже при ошибке загрузки пользователя
    return next();
  }
};

// Middleware для проверки авторизации (применяется к защищенным командам)
export const authMiddleware = async (ctx: BotContext, next: () => Promise<void>) => {
  try {
    // Если пользователь ожидает ввод ключа доступа, пропускаем проверку авторизации
    if (ctx.awaitingAccessKey) {
      return next();
    }

    // Проверяем, авторизован ли пользователь
    if (!ctx.user) {
      await ctx.reply('❌ Вы не авторизованы. Используйте команду /start для начала работы.');
      return;
    }

    return next();
    
  } catch (error) {
    logger.error('Error in authMiddleware', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });
    
    await ctx.reply('❌ Произошла ошибка аутентификации. Попробуйте еще раз позже.');
  }
};

// Middleware для проверки прав администратора
export const adminMiddleware = async (ctx: BotContext, next: () => Promise<void>) => {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Вы не авторизованы. Используйте команду /start для начала работы.');
      return;
    }

    if (!ctx.user.isAdmin) {
      await ctx.reply('❌ У вас нет прав администратора для выполнения этой команды.');
      return;
    }

    return next();
    
  } catch (error) {
    logger.error('Error in adminMiddleware', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });
    
    await ctx.reply('❌ Произошла ошибка проверки прав доступа.');
  }
};
