import { BotContext } from '../middleware/auth';
import { DatabaseService } from '../../services/database';
import { logger } from '../../utils/logger';

// Интерфейс для параметров фильтрации
interface UsersFilter {
  status?: 'all' | 'active' | 'inactive' | 'admin' | 'user';
  search?: string;
  page?: number;
  limit?: number;
}

// Основной обработчик списка пользователей
export const listUsersHandler = async (ctx: BotContext) => {
  try {
    // Проверяем права администратора
    if (!ctx.user?.isAdmin) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    const filter: UsersFilter = {
      status: 'all',
      page: 1,
      limit: 5
    };

    await showUsersList(ctx, filter);

  } catch (error) {
    logger.error('Error in listUsersHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.reply('❌ Произошла ошибка при загрузке списка пользователей. Попробуйте позже.');
  }
};

// Функция отображения списка пользователей
const showUsersList = async (ctx: BotContext, filter: UsersFilter) => {
  try {
    const loadingMessage = await ctx.reply('🔄 Загружаем список пользователей...');

    // Получаем всех пользователей из базы данных
    const allUsers = await DatabaseService.getClient().user.findMany({
      include: {
        accessKey: {
          select: {
            key: true,
            isActive: true,
            createdAt: true,
            usedAt: true
          }
        },
        _count: {
          select: {
            messages: true,
            usage: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Применяем фильтры
    let filteredUsers = allUsers;

    // Фильтр по статусу
    if (filter.status && filter.status !== 'all') {
      filteredUsers = filteredUsers.filter(user => {
        switch (filter.status) {
          case 'active':
            return user.isActive;
          case 'inactive':
            return !user.isActive;
          case 'admin':
            return user.isAdmin;
          case 'user':
            return !user.isAdmin;
          default:
            return true;
        }
      });
    }

    // Фильтр по поиску
    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      filteredUsers = filteredUsers.filter(user => {
        const nameMatch = user.firstName?.toLowerCase().includes(searchTerm) ||
                         user.lastName?.toLowerCase().includes(searchTerm) ||
                         user.username?.toLowerCase().includes(searchTerm);
        const idMatch = user.id.toLowerCase().includes(searchTerm) ||
                       user.telegramId.toString().includes(searchTerm);
        return nameMatch || idMatch;
      });
    }

    // Пагинация
    const totalUsers = filteredUsers.length;
    const totalPages = Math.ceil(totalUsers / (filter.limit || 5));
    const currentPage = filter.page || 1;
    const offset = ((currentPage - 1) * (filter.limit || 5));
    const paginatedUsers = filteredUsers.slice(offset, offset + (filter.limit || 5));

    // Удаляем сообщение о загрузке
    await ctx.deleteMessage(loadingMessage.message_id);

    // Формируем сообщение
    let message = `👥 <b>Список пользователей</b>\n\n`;
    
    // Информация о фильтрах
    const statusLabels = {
      all: 'Все',
      active: 'Активные',
      inactive: 'Неактивные',
      admin: 'Администраторы',
      user: 'Пользователи'
    };
    
    message += `📊 <b>Фильтр:</b> ${statusLabels[filter.status || 'all']}\n`;
    if (filter.search) {
      message += `🔍 <b>Поиск:</b> "${filter.search}"\n`;
    }
    message += `📄 <b>Страница:</b> ${currentPage} из ${totalPages}\n`;
    message += `📈 <b>Найдено:</b> ${totalUsers} пользователей\n\n`;

    if (paginatedUsers.length === 0) {
      message += '❌ Пользователи не найдены.\n\n';
    } else {
      // Отображаем пользователей
      paginatedUsers.forEach((user, index) => {
        const userNumber = offset + index + 1;
        const statusIcon = user.isActive ? '✅' : '❌';
        const roleIcon = user.isAdmin ? '👑' : '👤';
        const userName = user.firstName || user.username || `ID: ${user.telegramId}`;
        
        message += `${userNumber}. ${statusIcon} ${roleIcon} <b>${userName}</b>\n`;
        message += `   🆔 ID: <code>${user.id}</code>\n`;
        message += `   📱 Telegram: <code>${user.telegramId}</code>\n`;
        message += `   📅 Регистрация: ${user.createdAt.toLocaleDateString('ru-RU')}\n`;
        
        // Информация о ключе
        if (user.accessKey) {
          const keyShort = `${user.accessKey.key.substring(0, 8)}...${user.accessKey.key.slice(-4)}`;
          const keyStatus = user.accessKey.isActive ? '🔑 активен' : '🔒 неактивен';
          message += `   🔑 Ключ: ${keyShort} (${keyStatus})\n`;
        } else {
          message += `   🔑 Ключ: не найден\n`;
        }
        
        // Статистика активности
        message += `   📊 Активность: ${user._count.messages} сообщений, ${user._count.usage} запросов\n`;
        message += '\n';
      });
    }

    // Создаем клавиатуру
    const keyboard = createUsersKeyboard(filter, totalPages, currentPage, paginatedUsers);

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });

    // Логируем просмотр списка пользователей
    logger.info('Users list viewed', {
      adminId: ctx.user?.id,
      filter,
      totalUsers,
      currentPage,
      totalPages
    });

  } catch (error) {
    logger.error('Error in showUsersList', {
      error: error instanceof Error ? error.message : 'Unknown error',
      filter
    });
    throw error;
  }
};

// Функция создания клавиатуры для управления списком
const createUsersKeyboard = (filter: UsersFilter, totalPages: number, currentPage: number, users: any[]) => {
  const keyboard = [];

  // Фильтры по статусу
  const statusRow1 = [
    {
      text: filter.status === 'all' ? '• Все' : 'Все',
      callback_data: `users_filter_all_${currentPage}`
    },
    {
      text: filter.status === 'active' ? '• Активные' : 'Активные',
      callback_data: `users_filter_active_${currentPage}`
    },
    {
      text: filter.status === 'inactive' ? '• Неактивные' : 'Неактивные',
      callback_data: `users_filter_inactive_${currentPage}`
    }
  ];

  const statusRow2 = [
    {
      text: filter.status === 'admin' ? '• Администраторы' : 'Администраторы',
      callback_data: `users_filter_admin_${currentPage}`
    },
    {
      text: filter.status === 'user' ? '• Пользователи' : 'Пользователи',
      callback_data: `users_filter_user_${currentPage}`
    }
  ];

  keyboard.push(statusRow1, statusRow2);

  // Кнопки действий для пользователей на текущей странице
  if (users.length > 0) {
    const offset = ((currentPage - 1) * (filter.limit || 5));
    users.forEach((user, index) => {
      const userNumber = offset + index + 1;
      
      const userRow = [
        {
          text: `👁️ Детали ${userNumber}`,
          callback_data: `users_details_${user.id}_${currentPage}_${filter.status || 'all'}`
        }
      ];

      // Кнопка удаления (только для не-админов или если админов больше 1)
      const adminCount = users.filter(u => u.isAdmin).length;
      if (!user.isAdmin || adminCount > 1) {
        userRow.push({
          text: `🗑️ Удалить ${userNumber}`,
          callback_data: `users_delete_${user.id}_${currentPage}_${filter.status || 'all'}`
        });
      }

      keyboard.push(userRow);
    });
  }

  // Пагинация
  if (totalPages > 1) {
    const paginationRow = [];
    
    if (currentPage > 1) {
      paginationRow.push({
        text: '⬅️ Назад',
        callback_data: `users_page_${currentPage - 1}_${filter.status || 'all'}`
      });
    }
    
    paginationRow.push({
      text: `${currentPage}/${totalPages}`,
      callback_data: 'users_page_info'
    });
    
    if (currentPage < totalPages) {
      paginationRow.push({
        text: 'Вперед ➡️',
        callback_data: `users_page_${currentPage + 1}_${filter.status || 'all'}`
      });
    }
    
    keyboard.push(paginationRow);
  }

  // Управляющие кнопки
  const controlRow1 = [
    {
      text: '🔍 Поиск',
      callback_data: 'users_search'
    },
    {
      text: '🔄 Обновить',
      callback_data: `users_refresh_${currentPage}_${filter.status || 'all'}`
    }
  ];

  const controlRow2 = [
    {
      text: '📊 Статистика',
      callback_data: `users_statistics_${currentPage}_${filter.status || 'all'}`
    },
    {
      text: '🔙 Админ-панель',
      callback_data: 'admin_panel'
    }
  ];

  const controlRow3 = [
    {
      text: '❌ Закрыть',
      callback_data: 'users_close'
    }
  ];

  keyboard.push(controlRow1, controlRow2, controlRow3);

  return keyboard;
};

// Обработчик просмотра деталей пользователя
export const handleUserDetails = async (ctx: BotContext, userId: string, page: number, status: string) => {
  try {
    if (!ctx.user?.isAdmin) {
      await ctx.answerCbQuery('❌ Недостаточно прав');
      return;
    }

    // Получаем детальную информацию о пользователе
    const user = await DatabaseService.getClient().user.findUnique({
      where: { id: userId },
      include: {
        accessKey: true,
        messages: {
          select: {
            id: true,
            content: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        usage: {
          select: {
            id: true,
            tokens: true,
            model: true,
            requestType: true,
            date: true
          },
          orderBy: { date: 'desc' },
          take: 5
        },
        _count: {
          select: {
            messages: true,
            usage: true
          }
        }
      }
    });

    if (!user) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }

    const userName = user.firstName || user.username || `ID: ${user.telegramId}`;
    
    // Статистика использования
    const totalUsage = await DatabaseService.getClient().usage.aggregate({
      where: { userId: user.id },
      _sum: { tokens: true },
      _count: { id: true }
    });

    const detailsMessage = `👤 <b>Детали пользователя</b>

📋 <b>Основная информация:</b>
• Имя: ${userName}
• ID: <code>${user.id}</code>
• Telegram ID: <code>${user.telegramId}</code>
• Username: ${user.username ? `@${user.username}` : 'не указан'}
• Статус: ${user.isActive ? '✅ активен' : '❌ неактивен'}
• Роль: ${user.isAdmin ? '👑 администратор' : '👤 пользователь'}
• Регистрация: ${user.createdAt.toLocaleString('ru-RU')}

🔑 <b>Ключ доступа:</b>
• ID ключа: <code>${user.accessKey?.id || 'не найден'}</code>
• Статус ключа: ${user.accessKey?.isActive ? '✅ активен' : '❌ неактивен'}
• Создан: ${user.accessKey?.createdAt.toLocaleDateString('ru-RU') || 'неизвестно'}
• Использован: ${user.accessKey?.usedAt?.toLocaleDateString('ru-RU') || 'не использован'}

📊 <b>Статистика использования:</b>
• Всего сообщений: ${user._count.messages}
• Всего запросов: ${user._count.usage}
• Токенов использовано: ${totalUsage._sum?.tokens || 0}

📝 <b>Последние сообщения (${Math.min(5, user.messages.length)}):</b>
${user.messages.length > 0 ? 
  user.messages.map((msg, i) => 
    `${i + 1}. ${msg.createdAt.toLocaleDateString('ru-RU')}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`
  ).join('\n') : 
  'Нет сообщений'
}

🔧 <b>Последние запросы (${Math.min(5, user.usage.length)}):</b>
${user.usage.length > 0 ? 
  user.usage.map((usage, i) => 
    `${i + 1}. ${usage.date.toLocaleDateString('ru-RU')}: ${usage.model} (${usage.tokens} токенов, ${usage.requestType})`
  ).join('\n') : 
  'Нет запросов'
}`;

    await ctx.editMessageText(detailsMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🗑️ Удалить пользователя',
              callback_data: `users_delete_${userId}_${page}_${status}`
            }
          ],
          [
            {
              text: '🔄 Обновить детали',
              callback_data: `users_details_${userId}_${page}_${status}`
            }
          ],
          [
            {
              text: '🔙 Назад к списку',
              callback_data: `users_refresh_${page}_${status}`
            }
          ]
        ]
      }
    });

    await ctx.answerCbQuery('📋 Детали пользователя');

  } catch (error) {
    logger.error('Error in handleUserDetails', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      adminId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.answerCbQuery('❌ Ошибка при загрузке деталей');
  }
};

// Обработчик удаления пользователя
export const handleUserDeletion = async (ctx: BotContext, userId: string, page: number, status: string) => {
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
        _count: {
          select: {
            messages: true,
            usage: true
          }
        }
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
• Роль: ${user.isAdmin ? '👑 администратор' : '👤 пользователь'}
• Регистрация: ${user.createdAt.toLocaleDateString('ru-RU')}

📊 <b>Статистика:</b>
• Сообщений: ${user._count.messages}
• Запросов: ${user._count.usage}

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
              callback_data: `users_confirm_delete_${userId}_${page}_${status}`
            }
          ],
          [
            {
              text: '❌ Отмена',
              callback_data: `users_refresh_${page}_${status}`
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
export const handleUserDeletionConfirmation = async (ctx: BotContext, userId: string, page: number, status: string) => {
  try {
    if (!ctx.user?.isAdmin) {
      await ctx.answerCbQuery('❌ Недостаточно прав');
      return;
    }

    // Получаем информацию о пользователе перед удалением
    const user = await DatabaseService.getClient().user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            messages: true,
            usage: true
          }
        }
      }
    });

    if (!user) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }

    const userName = user.firstName || user.username || `ID: ${user.telegramId}`;
    const messagesCount = user._count.messages;
    const usageCount = user._count.usage;

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
              text: '🔄 Обновить список',
              callback_data: `users_refresh_${page}_${status}`
            }
          ],
          [
            {
              text: '🔙 Админ-панель',
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

// Обработчик статистики пользователей
export const handleUsersStatistics = async (ctx: BotContext, page: number, status: string) => {
  try {
    if (!ctx.user?.isAdmin) {
      await ctx.answerCbQuery('❌ Недостаточно прав');
      return;
    }

    // Получаем статистику
    const totalUsers = await DatabaseService.getClient().user.count();
    const activeUsers = await DatabaseService.getClient().user.count({
      where: { isActive: true }
    });
    const adminUsers = await DatabaseService.getClient().user.count({
      where: { isAdmin: true }
    });

    const totalMessages = await DatabaseService.getClient().message.count();
    const totalUsage = await DatabaseService.getClient().usage.aggregate({
      _sum: { tokens: true },
      _count: { id: true }
    });

    // Статистика по дням (последние 7 дней)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentUsers = await DatabaseService.getClient().user.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    });

    const recentMessages = await DatabaseService.getClient().message.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    });

    // Топ пользователей по активности
    const topUsers = await DatabaseService.getClient().user.findMany({
      include: {
        _count: {
          select: {
            messages: true,
            usage: true
          }
        }
      },
      orderBy: {
        messages: {
          _count: 'desc'
        }
      },
      take: 5
    });

    const statisticsMessage = `📊 <b>Статистика пользователей</b>

👥 <b>Общая статистика:</b>
• Всего пользователей: ${totalUsers}
• Активных: ${activeUsers}
• Неактивных: ${totalUsers - activeUsers}
• Администраторов: ${adminUsers}

💬 <b>Активность:</b>
• Всего сообщений: ${totalMessages}
• Всего запросов: ${totalUsage._count.id || 0}
• Токенов использовано: ${totalUsage._sum?.tokens || 0}

📅 <b>За последние 7 дней:</b>
• Новых пользователей: ${recentUsers}
• Новых сообщений: ${recentMessages}

🏆 <b>Топ-5 активных пользователей:</b>
${topUsers.map((user, i) => {
  const userName = user.firstName || user.username || `ID: ${user.telegramId}`;
  return `${i + 1}. ${userName} (${user._count.messages} сообщений, ${user._count.usage} запросов)`;
}).join('\n')}

📈 <b>Средние показатели:</b>
• Сообщений на пользователя: ${totalUsers > 0 ? Math.round(totalMessages / totalUsers) : 0}
• Токенов на пользователя: ${totalUsers > 0 ? Math.round((totalUsage._sum?.tokens || 0) / totalUsers) : 0}`;

    await ctx.editMessageText(statisticsMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔄 Обновить статистику',
              callback_data: `users_statistics_${page}_${status}`
            }
          ],
          [
            {
              text: '🔙 Назад к списку',
              callback_data: `users_refresh_${page}_${status}`
            }
          ]
        ]
      }
    });

    await ctx.answerCbQuery('📊 Статистика обновлена');

  } catch (error) {
    logger.error('Error in handleUsersStatistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.answerCbQuery('❌ Ошибка при загрузке статистики');
  }
};

// Обработчик callback-запросов для списка пользователей
export const handleUsersCallbacks = async (ctx: BotContext, callbackData: string) => {
  try {
    const parts = callbackData.split('_');
    
    if (parts[0] !== 'users') return;

    await ctx.answerCbQuery();

    switch (parts[1]) {
      case 'filter':
        const status = parts[2] as UsersFilter['status'];
        const pageStr = parts[3];
        const page = pageStr ? parseInt(pageStr) || 1 : 1;
        await ctx.deleteMessage();
        if (status) {
          await showUsersList(ctx, { status, page });
        }
        break;

      case 'page':
        const newPageStr = parts[2];
        const newPage = newPageStr ? parseInt(newPageStr) : 1;
        const filterStatus = parts[3] as UsersFilter['status'];
        await ctx.deleteMessage();
        if (filterStatus && newPageStr) {
          await showUsersList(ctx, { status: filterStatus, page: newPage });
        }
        break;

      case 'refresh':
        const refreshPageStr = parts[2];
        const refreshPage = refreshPageStr ? parseInt(refreshPageStr) || 1 : 1;
        const refreshStatus = parts[3] as UsersFilter['status'];
        await ctx.deleteMessage();
        if (refreshStatus && refreshPageStr) {
          await showUsersList(ctx, { status: refreshStatus, page: refreshPage });
        }
        break;

      case 'details':
        const detailsUserId = parts[2];
        const detailsPageStr = parts[3];
        const detailsPage = detailsPageStr ? parseInt(detailsPageStr) || 1 : 1;
        const detailsStatus = parts[4] || 'all';
        if (detailsUserId) {
          await handleUserDetails(ctx, detailsUserId, detailsPage, detailsStatus);
        }
        break;

      case 'delete':
        const deleteUserId = parts[2];
        const deletePageStr = parts[3];
        const deletePage = deletePageStr ? parseInt(deletePageStr) || 1 : 1;
        const deleteStatus = parts[4] || 'all';
        if (deleteUserId) {
          await handleUserDeletion(ctx, deleteUserId, deletePage, deleteStatus);
        }
        break;

      case 'confirm':
        if (parts[2] === 'delete') {
          const confirmUserId = parts[3];
          const confirmPageStr = parts[4];
          const confirmPage = confirmPageStr ? parseInt(confirmPageStr) || 1 : 1;
          const confirmStatus = parts[5] || 'all';
          if (confirmUserId) {
            await handleUserDeletionConfirmation(ctx, confirmUserId, confirmPage, confirmStatus);
          }
        }
        break;

      case 'statistics':
        const statsPageStr = parts[2];
        const statsPage = statsPageStr ? parseInt(statsPageStr) || 1 : 1;
        const statsStatus = parts[3] || 'all';
        await handleUsersStatistics(ctx, statsPage, statsStatus);
        break;

      case 'search':
        await ctx.deleteMessage();
        await ctx.reply('🔍 <b>Поиск по пользователям</b>\n\nВведите текст для поиска по имени, username или ID:', {
          parse_mode: 'HTML'
        });
        // Здесь нужно будет добавить обработку ввода поиска
        break;

      case 'close':
        await ctx.deleteMessage();
        await ctx.reply('👥 Список пользователей закрыт.');
        break;

      default:
        await ctx.answerCbQuery('❌ Неизвестная команда');
        break;
    }

  } catch (error) {
    logger.error('Error in handleUsersCallbacks', {
      error: error instanceof Error ? error.message : 'Unknown error',
      callbackData,
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.answerCbQuery('❌ Произошла ошибка');
  }
};
