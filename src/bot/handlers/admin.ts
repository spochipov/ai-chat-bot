import { BotContext } from '../middleware/auth';
import { logger } from '../../utils/logger';

export const adminHandler = async (ctx: BotContext) => {
  try {
    // Проверяем наличие пользователя (должно быть гарантировано middleware)
    if (!ctx.user) {
      await ctx.reply('❌ Ошибка: Данные пользователя не найдены.');
      return;
    }

    const adminMessage = `🔧 *Панель администратора*

Добро пожаловать в административную панель бота!

👤 **Администратор:** ${ctx.user.id}
📅 **Время входа:** ${new Date().toLocaleString('ru-RU')}

Выберите действие из меню ниже:`;

    await ctx.reply(adminMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔑 Создать ключ доступа',
              callback_data: 'admin_generate_key'
            }
          ],
          [
            {
              text: '📋 Список ключей',
              callback_data: 'admin_list_keys'
            },
            {
              text: '🗑️ Деактивировать ключ',
              callback_data: 'admin_deactivate_key'
            }
          ],
          [
            {
              text: '👥 Список пользователей',
              callback_data: 'admin_list_users'
            },
            {
              text: '📊 Статистика пользователя',
              callback_data: 'admin_user_stats'
            }
          ],
          [
            {
              text: '💰 Баланс системы',
              callback_data: 'admin_balance'
            },
            {
              text: '📈 Аналитика',
              callback_data: 'admin_analytics'
            }
          ],
          [
            {
              text: '❌ Закрыть панель',
              callback_data: 'admin_close'
            }
          ]
        ]
      }
    });

    // Логируем обращение к админ панели
    logger.info('Admin panel accessed', {
      adminId: ctx.user.id,
      adminTelegramId: ctx.user.telegramId.toString(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error in adminHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.reply('❌ Произошла неожиданная ошибка при открытии админ панели. Попробуйте еще раз позже.');
  }
};

// Обработчик callback-запросов для админ панели
export const adminCallbackHandler = async (ctx: BotContext) => {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
      return;
    }

    const callbackData = ctx.callbackQuery.data;

    // Обрабатываем только админские callback-запросы
    if (!callbackData.startsWith('admin_')) {
      return;
    }

    // Проверяем права администратора
    if (!ctx.user || !ctx.user.isAdmin) {
      await ctx.answerCbQuery('❌ У вас нет прав администратора');
      return;
    }

    // Импортируем обработчики команд
    const { generateKeyHandler } = await import('./generateKey');
    const { listKeysHandler } = await import('./listKeys');
    const { deactivateKeyHandler } = await import('./deactivateKey');
    const { listUsersHandler } = await import('./listUsers');
    const { userStatsHandler } = await import('./userStats');
    const { balanceHandler } = await import('./balance');
    const { analyticsHandler } = await import('./analytics');

    switch (callbackData) {
      case 'admin_generate_key':
        await ctx.answerCbQuery('🔄 Генерируем ключ...');
        // Удаляем сообщение с панелью
        await ctx.deleteMessage();
        // Выполняем команду генерации ключа
        await generateKeyHandler(ctx);
        break;

      case 'admin_list_keys':
        await ctx.answerCbQuery('🔄 Загружаем список ключей...');
        await ctx.deleteMessage();
        await listKeysHandler(ctx);
        break;

      case 'admin_deactivate_key':
        await ctx.answerCbQuery('🔄 Переходим к деактивации ключа...');
        await ctx.deleteMessage();
        await deactivateKeyHandler(ctx);
        break;

      case 'admin_list_users':
        await ctx.answerCbQuery('🔄 Загружаем список пользователей...');
        await ctx.deleteMessage();
        await listUsersHandler(ctx);
        break;

      case 'admin_user_stats':
        await ctx.answerCbQuery('🔄 Загружаем статистику...');
        await ctx.deleteMessage();
        await userStatsHandler(ctx);
        break;

      case 'admin_balance':
        await ctx.answerCbQuery('🔄 Проверяем баланс...');
        await ctx.deleteMessage();
        await balanceHandler(ctx);
        break;

      case 'admin_analytics':
        await ctx.answerCbQuery('🔄 Загружаем аналитику...');
        await ctx.deleteMessage();
        await analyticsHandler(ctx);
        break;

      case 'admin_close':
        await ctx.answerCbQuery('✅ Панель закрыта');
        await ctx.editMessageText('🔧 Административная панель закрыта.\n\nДля повторного открытия используйте команду /admin');
        break;

      default:
        await ctx.answerCbQuery('❌ Неизвестная команда');
        break;
    }

    // Логируем действие в админ панели
    logger.info('Admin panel action', {
      action: callbackData,
      adminId: ctx.user.id,
      adminTelegramId: ctx.user.telegramId.toString(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error in adminCallbackHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id,
      callbackData: ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : 'unknown'
    });

    await ctx.answerCbQuery('❌ Произошла ошибка при обработке команды');
  }
};
