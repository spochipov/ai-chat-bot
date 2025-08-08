import { BotContext } from '../middleware/auth';
import { handleAccessKeyInput } from './start';
import { logger } from '../../utils/logger';

export const messageHandler = async (ctx: BotContext) => {
  try {
    // Проверяем, ожидает ли пользователь ввод ключа доступа
    if (ctx.awaitingAccessKey) {
      const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      
      if (!messageText) {
        await ctx.reply('❌ Пожалуйста, отправьте ключ доступа текстовым сообщением.');
        return;
      }
      
      // Обрабатываем ключ доступа
      const success = await handleAccessKeyInput(ctx, messageText.trim());
      
      if (success) {
        // Регистрация прошла успешно, флаг awaitingAccessKey уже сброшен в handleAccessKeyInput
        return;
      } else {
        // Ошибка при обработке ключа, просим попробовать еще раз
        await ctx.reply('🔑 Пожалуйста, попробуйте ввести ключ доступа еще раз:');
        return;
      }
    }
    
    // Проверяем, авторизован ли пользователь
    if (!ctx.user) {
      await ctx.reply('❌ Вы не авторизованы. Используйте команду /start для начала работы.');
      return;
    }
    
    // Проверяем, активен ли пользователь
    if (!ctx.user || !ctx.user.id) {
      await ctx.reply('❌ Ошибка авторизации. Попробуйте перезапустить бота командой /start.');
      return;
    }
    
    // Получаем текст сообщения
    const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    
    if (!messageText) {
      await ctx.reply('❌ Пожалуйста, отправьте текстовое сообщение.');
      return;
    }
    
    // TODO: Здесь будет обработка сообщения через AI
    // Пока что просто отвечаем заглушкой
    await ctx.reply(`Получено сообщение: "${messageText}"\n\n🚧 Обработка AI сообщений будет реализована позже.`);
    
    logger.info('Message received from user', {
      userId: ctx.user.id,
      telegramId: ctx.user.telegramId.toString(),
      messageLength: messageText.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error in messageHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });
    
    await ctx.reply('❌ Произошла ошибка при обработке сообщения. Попробуйте еще раз позже.');
  }
};
