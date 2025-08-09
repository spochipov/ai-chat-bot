import { BotContext } from '../middleware/auth';
import { createAccessKey } from '../../../scripts/generate-key';
import { logger } from '../../utils/logger';

export const generateKeyHandler = async (ctx: BotContext) => {
  try {
    // Проверяем наличие пользователя (должно быть гарантировано middleware)
    if (!ctx.user) {
      await ctx.reply('❌ Ошибка: Данные пользователя не найдены.');
      return;
    }

    // Отправляем сообщение о начале генерации
    const loadingMessage = await ctx.reply('🔄 Генерирую новый ключ доступа...');

    try {
      // Генерируем новый ключ доступа
      const newAccessKey = await createAccessKey(ctx.user.id);

      // Удаляем сообщение о загрузке
      await ctx.deleteMessage(loadingMessage.message_id);

      // Отправляем результат
      const successMessage = `✅ *Новый ключ доступа создан успешно!*

🔑 **Ключ:** \`${newAccessKey}\`
👤 **Создан администратором:** ${ctx.user.id}
📅 **Дата создания:** ${new Date().toLocaleString('ru-RU')}

📋 *Инструкции:*
• Передайте этот ключ пользователю для получения доступа к боту
• Пользователь должен отправить команду /start и ввести этот ключ
• Ключ можно использовать только один раз
• Храните ключ в безопасности

⚠️ *Важно:* Не публикуйте ключ в открытых чатах или каналах!`;

      await ctx.reply(successMessage, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📊 Список всех ключей',
                callback_data: 'list_all_keys'
              }
            ]
          ]
        }
      });

      // Логируем успешную генерацию
      logger.info('Access key generated via bot', {
        keyId: newAccessKey,
        adminId: ctx.user.id,
        adminTelegramId: ctx.user.telegramId.toString(),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // Удаляем сообщение о загрузке в случае ошибки
      try {
        await ctx.deleteMessage(loadingMessage.message_id);
      } catch (deleteError) {
        // Игнорируем ошибки удаления сообщения
      }

      logger.error('Failed to generate access key via bot', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: ctx.user.id,
        adminTelegramId: ctx.user.telegramId.toString()
      });

      await ctx.reply('❌ Ошибка при генерации ключа доступа. Попробуйте еще раз или обратитесь к разработчику.');
    }

  } catch (error) {
    logger.error('Error in generateKeyHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.reply('❌ Произошла неожиданная ошибка. Попробуйте еще раз позже.');
  }
};
