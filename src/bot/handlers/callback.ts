import { BotContext } from '../middleware/auth';
import { logger } from '../../utils/logger';
import { adminCallbackHandler } from './admin';

// Обработчик callback-запросов из help
const handleHelpCallbacks = async (ctx: BotContext, callbackData: string) => {
  try {
    switch (callbackData) {
      case 'help_admin_panel':
        await ctx.answerCbQuery('🔄 Открываем панель администратора...');
        const { adminHandler } = await import('./admin');
        await adminHandler(ctx);
        break;

      case 'help_generate_key':
        await ctx.answerCbQuery('🔄 Генерируем ключ...');
        const { generateKeyHandler } = await import('./generateKey');
        await generateKeyHandler(ctx);
        break;

      case 'help_list_keys':
        await ctx.answerCbQuery('🔄 Загружаем список ключей...');
        const { listKeysHandler } = await import('./listKeys');
        await listKeysHandler(ctx);
        break;

      case 'help_status':
        await ctx.answerCbQuery('🔄 Загружаем статус...');
        const { statusHandler } = await import('./status');
        await statusHandler(ctx);
        break;

      case 'help_clear':
        await ctx.answerCbQuery('🔄 Очищаем историю...');
        const { clearHandler } = await import('./clear');
        await clearHandler(ctx);
        break;

      case 'help_start_auth':
        await ctx.answerCbQuery('🔄 Начинаем авторизацию...');
        const { startHandler } = await import('./start');
        await startHandler(ctx);
        break;

      default:
        await ctx.answerCbQuery('❌ Неизвестная команда');
        break;
    }
  } catch (error) {
    logger.error('Error in handleHelpCallbacks', {
      error: error instanceof Error ? error.message : 'Unknown error',
      callbackData,
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });
    await ctx.answerCbQuery('❌ Произошла ошибка при выполнении команды');
  }
};

// Универсальный обработчик callback-запросов
export const callbackHandler = async (ctx: BotContext) => {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
      return;
    }

    const callbackData = ctx.callbackQuery.data;

    // Обрабатываем админские callback-запросы
    if (callbackData.startsWith('admin_')) {
      await adminCallbackHandler(ctx);
      return;
    }


    // Обрабатываем callback-запросы для списка ключей
    if (callbackData === 'list_all_keys') {
      await ctx.answerCbQuery('🔄 Загружаем список ключей...');
      // Динамически импортируем и выполняем обработчик
      const { listKeysHandler } = await import('./listKeys');
      await listKeysHandler(ctx);
      return;
    }

    // Обрабатываем callback-запросы из help
    if (callbackData.startsWith('help_')) {
      await handleHelpCallbacks(ctx, callbackData);
      return;
    }

    // Обрабатываем callback-запросы для списка ключей
    if (callbackData.startsWith('keys_')) {
      const { handleKeysCallbacks } = await import('./listKeys');
      await handleKeysCallbacks(ctx, callbackData);
      return;
    }

    // Обрабатываем callback-запросы для баланса
    if (callbackData.startsWith('balance_')) {
      const { handleBalanceCallbacks } = await import('./balance');
      await handleBalanceCallbacks(ctx, callbackData);
      return;
    }

    // Если callback-запрос не распознан
    await ctx.answerCbQuery('❌ Неизвестная команда');
    
    logger.warn('Unknown callback query', {
      callbackData,
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

  } catch (error) {
    logger.error('Error in callbackHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id,
      callbackData: ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : 'unknown'
    });

    await ctx.answerCbQuery('❌ Произошла ошибка при обработке команды');
  }
};
