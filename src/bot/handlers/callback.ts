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

    // Обрабатываем callback-запросы для запроса доступа
    if (callbackData === 'request_access') {
      const { handleAccessRequest } = await import('./accessRequest');
      await handleAccessRequest(ctx, callbackData);
      return;
    }

    // Обрабатываем callback-запрос для ввода ключа доступа
    if (callbackData === 'enter_access_key') {
      await ctx.answerCbQuery('🔑 Введите ключ доступа');
      ctx.session.awaitingAccessKey = true;
      ctx.awaitingAccessKey = true;
      
      const keyInputMessage = `🔑 <b>Ввод ключа доступа</b>

Пожалуйста, отправьте ваш ключ доступа в следующем сообщении.

📝 <b>Формат ключа:</b> ACK_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

💡 <b>Совет:</b> скопируйте ключ полностью, включая префикс ACK_`;

      await ctx.editMessageText(keyInputMessage, { 
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔙 Назад к выбору',
                callback_data: 'back_to_start'
              }
            ]
          ]
        }
      });
      return;
    }

    // Обрабатываем callback-запрос для справки о доступе
    if (callbackData === 'access_help') {
      await ctx.answerCbQuery('📖 Показываем справку');
      
      const helpMessage = `❓ <b>Справка по получению доступа</b>

🔑 <b>Что такое ключ доступа?</b>
Ключ доступа - это уникальный код, который предоставляет доступ к AI чат-боту.

📝 <b>Формат ключа:</b>
• Начинается с ACK_
• Содержит 36 символов
• Пример: ACK_1234567890abcdef1234567890abcdef

📨 <b>Как получить ключ?</b>
1. Нажмите "Запросить доступ"
2. Ваш запрос будет отправлен администраторам
3. Администратор рассмотрит запрос и создаст ключ
4. Вы получите ключ в личном сообщении

⏱️ <b>Время ожидания:</b>
Обычно запросы рассматриваются в течение 24 часов

🔧 <b>Проблемы с ключом?</b>
• Проверьте правильность ввода
• Убедитесь, что ключ не использован
• Обратитесь к администратору`;

      await ctx.editMessageText(helpMessage, { 
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📨 Запросить доступ',
                callback_data: 'request_access'
              }
            ],
            [
              {
                text: '🔙 Назад к выбору',
                callback_data: 'back_to_start'
              }
            ]
          ]
        }
      });
      return;
    }

    // Обрабатываем callback-запрос для возврата к началу
    if (callbackData === 'back_to_start') {
      await ctx.answerCbQuery('🔄 Возвращаемся к выбору');
      const { startHandler } = await import('./start');
      await ctx.deleteMessage();
      await startHandler(ctx);
      return;
    }

    // Обрабатываем callback-запрос для закрытия сообщения
    if (callbackData === 'close_message') {
      const { handleCloseMessage } = await import('./accessRequest');
      await handleCloseMessage(ctx);
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
