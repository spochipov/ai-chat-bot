import { BotContext } from '../middleware/auth';
import { DatabaseService } from '../../services/database';
import { logger } from '../../utils/logger';

// Обработчик запроса доступа
export const handleAccessRequest = async (ctx: BotContext, callbackData: string) => {
  try {
    const telegramId = BigInt(ctx.from!.id);
    
    // Проверяем, не зарегистрирован ли уже пользователь
    const existingUser = await DatabaseService.findUserByTelegramId(telegramId);
    if (existingUser) {
      await ctx.answerCbQuery('❌ Вы уже зарегистрированы в системе');
      return;
    }

    // Получаем информацию о пользователе
    const userInfo = {
      telegramId: telegramId.toString(),
      username: ctx.from?.username || 'не указан',
      firstName: ctx.from?.first_name || 'не указано',
      lastName: ctx.from?.last_name || '',
      fullName: `${ctx.from?.first_name || ''} ${ctx.from?.last_name || ''}`.trim() || 'не указано'
    };

    // Получаем всех администраторов
    const admins = await DatabaseService.getClient().user.findMany({
      where: { isAdmin: true, isActive: true }
    });

    if (admins.length === 0) {
      await ctx.answerCbQuery('❌ Администраторы не найдены');
      await ctx.reply('❌ В системе не найдены активные администраторы. Попробуйте позже.');
      return;
    }

    // Формируем сообщение для администраторов
    const requestMessage = `🔔 <b>Новый запрос на доступ</b>

👤 <b>Информация о пользователе:</b>
• ID: <code>${userInfo.telegramId}</code>
• Имя: ${userInfo.fullName}
• Username: ${userInfo.username !== 'не указан' ? `@${userInfo.username}` : userInfo.username}

📅 <b>Дата запроса:</b> ${new Date().toLocaleString('ru-RU')}

💡 <b>Действия:</b>
• Для предоставления доступа создайте ключ командой /generate_key
• Отправьте ключ пользователю в личные сообщения`;

    // Отправляем уведомления всем администраторам
    let notifiedAdmins = 0;
    for (const admin of admins) {
      try {
        await ctx.telegram.sendMessage(
          admin.telegramId.toString(),
          requestMessage,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🔑 Создать ключ',
                    callback_data: 'admin_generate_key'
                  },
                  {
                    text: '👥 Список пользователей',
                    callback_data: 'admin_list_users'
                  }
                ],
                [
                  {
                    text: `💬 Написать пользователю`,
                    url: userInfo.username !== 'не указан' ? 
                         `https://t.me/${userInfo.username}` : 
                         `tg://user?id=${userInfo.telegramId}`
                  }
                ]
              ]
            }
          }
        );
        notifiedAdmins++;
      } catch (error) {
        logger.warn('Failed to notify admin about access request', {
          adminId: admin.id,
          adminTelegramId: admin.telegramId.toString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    await ctx.answerCbQuery('✅ Запрос отправлен администраторам');
    
    // Отправляем подтверждение пользователю
    const confirmationMessage = `✅ <b>Запрос на доступ отправлен!</b>

📨 Ваш запрос был отправлен администраторам системы.

⏱️ <b>Что дальше:</b>
• Администратор рассмотрит ваш запрос
• При одобрении вы получите ключ доступа
• Используйте команду /start и введите полученный ключ

🕐 <b>Время ожидания:</b> обычно до 24 часов

💡 <b>Совет:</b> следите за сообщениями от бота`;

    await ctx.editMessageText(confirmationMessage, { 
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔄 Отправить запрос повторно',
              callback_data: 'request_access'
            }
          ],
          [
            {
              text: '❌ Закрыть',
              callback_data: 'close_message'
            }
          ]
        ]
      }
    });

    logger.info('Access request sent to admins', {
      requesterTelegramId: userInfo.telegramId,
      requesterUsername: userInfo.username,
      requesterName: userInfo.fullName,
      notifiedAdmins,
      totalAdmins: admins.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error in handleAccessRequest', {
      error: error instanceof Error ? error.message : 'Unknown error',
      telegramId: ctx.from?.id,
      callbackData
    });

    await ctx.answerCbQuery('❌ Произошла ошибка при отправке запроса');
    await ctx.reply('❌ Произошла ошибка при отправке запроса. Попробуйте позже.');
  }
};

// Обработчик закрытия сообщения
export const handleCloseMessage = async (ctx: BotContext) => {
  try {
    await ctx.deleteMessage();
    await ctx.answerCbQuery('Сообщение закрыто');
  } catch (error) {
    await ctx.answerCbQuery('❌ Не удалось закрыть сообщение');
  }
};
