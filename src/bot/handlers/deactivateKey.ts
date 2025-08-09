import { BotContext } from '../middleware/auth';
import { DatabaseService } from '../../services/database';
import { logger } from '../../utils/logger';

export const deactivateKeyHandler = async (ctx: BotContext) => {
  try {
    // Проверяем права администратора
    if (!ctx.user?.isAdmin) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    // Получаем все активные ключи
    const activeKeys = await DatabaseService.getClient().accessKey.findMany({
      where: { isActive: true },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            telegramId: true,
            isActive: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (activeKeys.length === 0) {
      await ctx.reply('📋 Нет активных ключей доступа для деактивации.');
      return;
    }

    // Формируем сообщение со списком ключей
    let message = `🔑 <b>Активные ключи доступа</b>\n\n`;
    message += `📊 <b>Всего активных ключей:</b> ${activeKeys.length}\n\n`;

    const keyButtons: any[][] = [];
    
    activeKeys.forEach((key, index) => {
      const user = key.users[0]; // Один ключ = один пользователь
      const keyShort = `${key.key.substring(0, 8)}...${key.key.substring(-4)}`;
      const createdDate = key.createdAt.toLocaleDateString('ru-RU');
      const usedDate = key.usedAt ? key.usedAt.toLocaleDateString('ru-RU') : 'не использован';
      
      message += `🔸 <b>Ключ ${index + 1}:</b>\n`;
      message += `   • ID: <code>${key.id}</code>\n`;
      message += `   • Ключ: <code>${keyShort}</code>\n`;
      message += `   • Создан: ${createdDate}\n`;
      message += `   • Использован: ${usedDate}\n`;
      
      if (user) {
        const userName = user.firstName || user.username || `ID: ${user.telegramId}`;
        const userStatus = user.isActive ? '✅ активен' : '❌ неактивен';
        message += `   • Пользователь: ${userName} (${userStatus})\n`;
      } else {
        message += `   • Пользователь: не назначен\n`;
      }
      message += '\n';

      // Добавляем кнопку для деактивации ключа
      keyButtons.push([
        {
          text: `🔒 Деактивировать ключ ${index + 1}`,
          callback_data: `deactivate_key_${key.id}`
        }
      ]);

      // Если есть пользователь, добавляем кнопку для удаления пользователя
      if (user) {
        keyButtons.push([
          {
            text: `🗑️ Удалить пользователя ${index + 1}`,
            callback_data: `delete_user_${user.id}`
          }
        ]);
      }
    });

    // Добавляем кнопки управления
    keyButtons.push([
      {
        text: '🔄 Обновить список',
        callback_data: 'refresh_deactivate_keys'
      }
    ]);

    keyButtons.push([
      {
        text: '🔙 Назад в админ-панель',
        callback_data: 'admin_panel'
      }
    ]);

    // Разбиваем длинные сообщения
    const maxMessageLength = 4000;
    if (message.length <= maxMessageLength) {
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyButtons
        }
      });
    } else {
      // Отправляем информацию частями
      await ctx.reply(message.substring(0, maxMessageLength), { parse_mode: 'HTML' });
      await ctx.reply('⬇️ Выберите действие:', {
        reply_markup: {
          inline_keyboard: keyButtons
        }
      });
    }

    logger.info('Deactivate keys list shown', {
      adminId: ctx.user.id,
      adminTelegramId: ctx.user.telegramId.toString(),
      activeKeysCount: activeKeys.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error in deactivateKeyHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.reply('❌ Произошла ошибка при загрузке списка ключей. Попробуйте позже.');
  }
};

// Обработчик деактивации конкретного ключа
export const handleKeyDeactivation = async (ctx: BotContext, keyId: string) => {
  try {
    if (!ctx.user?.isAdmin) {
      await ctx.answerCbQuery('❌ Недостаточно прав');
      return;
    }

    // Получаем информацию о ключе
    const key = await DatabaseService.getClient().accessKey.findUnique({
      where: { id: keyId },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            telegramId: true,
            isActive: true
          }
        }
      }
    });

    if (!key) {
      await ctx.answerCbQuery('❌ Ключ не найден');
      return;
    }

    if (!key.isActive) {
      await ctx.answerCbQuery('❌ Ключ уже деактивирован');
      return;
    }

    // Деактивируем ключ
    await DatabaseService.updateAccessKey(keyId, {
      isActive: false
    });

    // Деактивируем связанных пользователей
    if (key.users.length > 0) {
      await DatabaseService.getClient().user.updateMany({
        where: { accessKeyId: keyId },
        data: { isActive: false }
      });
    }

    const user = key.users[0];
    const userName = user ? (user.firstName || user.username || `ID: ${user.telegramId}`) : 'не назначен';
    const keyShort = `${key.key.substring(0, 8)}...${key.key.substring(-4)}`;

    await ctx.answerCbQuery('✅ Ключ деактивирован');

    // Отправляем подтверждение
    const confirmationMessage = `✅ <b>Ключ успешно деактивирован</b>

🔑 <b>Информация о ключе:</b>
• ID: <code>${key.id}</code>
• Ключ: <code>${keyShort}</code>
• Пользователь: ${userName}

⚠️ <b>Последствия:</b>
• Ключ больше нельзя использовать для регистрации
• Связанные пользователи деактивированы
• Доступ к боту заблокирован

📅 <b>Деактивирован:</b> ${new Date().toLocaleString('ru-RU')}`;

    await ctx.editMessageText(confirmationMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔄 Обновить список ключей',
              callback_data: 'refresh_deactivate_keys'
            }
          ],
          [
            {
              text: '🔙 Назад в админ-панель',
              callback_data: 'admin_panel'
            }
          ]
        ]
      }
    });

    // Уведомляем пользователя о деактивации (если он существует)
    if (user && user.isActive) {
      try {
        await ctx.telegram.sendMessage(
          user.telegramId.toString(),
          `❌ <b>Ваш доступ к боту деактивирован</b>

🔑 Ваш ключ доступа был деактивирован администратором.

📞 <b>Для восстановления доступа:</b>
• Обратитесь к администратору
• Запросите новый ключ доступа

📅 <b>Дата деактивации:</b> ${new Date().toLocaleString('ru-RU')}`,
          { parse_mode: 'HTML' }
        );
      } catch (notificationError) {
        logger.warn('Failed to notify user about key deactivation', {
          userId: user.id,
          userTelegramId: user.telegramId.toString(),
          error: notificationError instanceof Error ? notificationError.message : 'Unknown error'
        });
      }
    }

    logger.info('Access key deactivated', {
      keyId,
      keyShort,
      adminId: ctx.user.id,
      adminTelegramId: ctx.user.telegramId.toString(),
      affectedUsersCount: key.users.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error in handleKeyDeactivation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      keyId,
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.answerCbQuery('❌ Ошибка при деактивации ключа');
  }
};

// Обработчик удаления пользователя
export const handleUserDeletion = async (ctx: BotContext, userId: string) => {
  try {
    if (!ctx.user?.isAdmin) {
      await ctx.answerCbQuery('❌ Недостаточно прав');
      return;
    }

    // Получаем информацию о пользователе
    const user = await DatabaseService.getClient().user.findUnique({
      where: { id: userId },
      include: {
        accessKey: true,
        messages: { take: 1 },
        usage: { take: 1 }
      }
    });

    if (!user) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }

    const userName = user.firstName || user.username || `ID: ${user.telegramId}`;

    // Показываем подтверждение удаления
    const confirmationMessage = `⚠️ <b>Подтверждение удаления пользователя</b>

👤 <b>Информация о пользователе:</b>
• ID: <code>${user.id}</code>
• Имя: ${userName}
• Telegram ID: <code>${user.telegramId}</code>
• Статус: ${user.isActive ? '✅ активен' : '❌ неактивен'}
• Регистрация: ${user.createdAt.toLocaleDateString('ru-RU')}

📊 <b>Статистика:</b>
• Сообщений: ${user.messages.length > 0 ? 'есть данные' : 'нет данных'}
• Использование: ${user.usage.length > 0 ? 'есть данные' : 'нет данных'}

⚠️ <b>ВНИМАНИЕ!</b>
Удаление пользователя приведет к:
• Полному удалению аккаунта
• Удалению всех сообщений
• Удалению статистики использования
• Невозможности восстановления данных

❓ <b>Вы уверены, что хотите удалить этого пользователя?</b>`;

    await ctx.editMessageText(confirmationMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🗑️ ДА, УДАЛИТЬ ПОЛЬЗОВАТЕЛЯ',
              callback_data: `confirm_delete_user_${userId}`
            }
          ],
          [
            {
              text: '❌ Отмена',
              callback_data: 'refresh_deactivate_keys'
            }
          ]
        ]
      }
    });

    await ctx.answerCbQuery('⚠️ Подтверждение удаления');

  } catch (error) {
    logger.error('Error in handleUserDeletion', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      adminId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.answerCbQuery('❌ Ошибка при подготовке удаления');
  }
};

// Обработчик подтверждения удаления пользователя
export const handleUserDeletionConfirmation = async (ctx: BotContext, userId: string) => {
  try {
    if (!ctx.user?.isAdmin) {
      await ctx.answerCbQuery('❌ Недостаточно прав');
      return;
    }

    // Получаем информацию о пользователе перед удалением
    const user = await DatabaseService.getClient().user.findUnique({
      where: { id: userId },
      include: {
        messages: true,
        usage: true
      }
    });

    if (!user) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }

    const userName = user.firstName || user.username || `ID: ${user.telegramId}`;
    const messagesCount = user.messages.length;
    const usageCount = user.usage.length;

    // Уведомляем пользователя об удалении (если он активен)
    if (user.isActive) {
      try {
        await ctx.telegram.sendMessage(
          user.telegramId.toString(),
          `❌ <b>Ваш аккаунт удален</b>

Ваш аккаунт был удален администратором.

📞 <b>Для получения нового доступа:</b>
• Обратитесь к администратору
• Запросите новый ключ доступа

📅 <b>Дата удаления:</b> ${new Date().toLocaleString('ru-RU')}`,
          { parse_mode: 'HTML' }
        );
      } catch (notificationError) {
        logger.warn('Failed to notify user about account deletion', {
          userId: user.id,
          userTelegramId: user.telegramId.toString(),
          error: notificationError instanceof Error ? notificationError.message : 'Unknown error'
        });
      }
    }

    // Удаляем пользователя (каскадное удаление сообщений и статистики)
    await DatabaseService.getClient().user.delete({
      where: { id: userId }
    });

    await ctx.answerCbQuery('✅ Пользователь удален');

    // Отправляем подтверждение
    const confirmationMessage = `✅ <b>Пользователь успешно удален</b>

👤 <b>Удаленный пользователь:</b>
• Имя: ${userName}
• ID: <code>${userId}</code>

📊 <b>Удаленные данные:</b>
• Сообщений: ${messagesCount}
• Записей использования: ${usageCount}

📅 <b>Удален:</b> ${new Date().toLocaleString('ru-RU')}

⚠️ <b>Данные удалены безвозвратно</b>`;

    await ctx.editMessageText(confirmationMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔄 Обновить список ключей',
              callback_data: 'refresh_deactivate_keys'
            }
          ],
          [
            {
              text: '🔙 Назад в админ-панель',
              callback_data: 'admin_panel'
            }
          ]
        ]
      }
    });

    logger.info('User deleted successfully', {
      deletedUserId: userId,
      deletedUserName: userName,
      deletedUserTelegramId: user.telegramId.toString(),
      messagesDeleted: messagesCount,
      usageRecordsDeleted: usageCount,
      adminId: ctx.user.id,
      adminTelegramId: ctx.user.telegramId.toString(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error in handleUserDeletionConfirmation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      adminId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.answerCbQuery('❌ Ошибка при удалении пользователя');
  }
};

// Обработчик callback-запросов для деактивации ключей
export const handleDeactivateCallbacks = async (ctx: BotContext, callbackData: string) => {
  try {
    if (callbackData === 'refresh_deactivate_keys') {
      await ctx.answerCbQuery('🔄 Обновляем список...');
      await deactivateKeyHandler(ctx);
      return;
    }

    if (callbackData.startsWith('deactivate_key_')) {
      const keyId = callbackData.replace('deactivate_key_', '');
      await handleKeyDeactivation(ctx, keyId);
      return;
    }

    if (callbackData.startsWith('delete_user_')) {
      const userId = callbackData.replace('delete_user_', '');
      await handleUserDeletion(ctx, userId);
      return;
    }

    if (callbackData.startsWith('confirm_delete_user_')) {
      const userId = callbackData.replace('confirm_delete_user_', '');
      await handleUserDeletionConfirmation(ctx, userId);
      return;
    }

    await ctx.answerCbQuery('❌ Неизвестная команда');

  } catch (error) {
    logger.error('Error in handleDeactivateCallbacks', {
      error: error instanceof Error ? error.message : 'Unknown error',
      callbackData,
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.answerCbQuery('❌ Произошла ошибка');
  }
};
