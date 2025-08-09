import { BotContext } from '../middleware/auth';
import { DatabaseService } from '../../services/database';
import { logger } from '../../utils/logger';

// Интерфейс для параметров фильтрации
interface KeysFilter {
  status?: 'all' | 'active' | 'inactive' | 'used' | 'unused';
  search?: string;
  page?: number;
  limit?: number;
}

// Основной обработчик списка ключей
export const listKeysHandler = async (ctx: BotContext) => {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Ошибка: Данные пользователя не найдены.');
      return;
    }

    const filter: KeysFilter = {
      status: 'all',
      page: 1,
      limit: 5
    };

    await showKeysList(ctx, filter);

  } catch (error) {
    logger.error('Error in listKeysHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.reply('❌ Произошла ошибка при загрузке списка ключей. Попробуйте еще раз позже.');
  }
};

// Функция отображения списка ключей
const showKeysList = async (ctx: BotContext, filter: KeysFilter) => {
  try {
    const loadingMessage = await ctx.reply('🔄 Загружаем список ключей...');

    // Получаем все ключи из базы данных
    const allKeys = await DatabaseService.getAllAccessKeys();
    
    // Применяем фильтры
    let filteredKeys = allKeys;

    // Фильтр по статусу
    if (filter.status && filter.status !== 'all') {
      filteredKeys = filteredKeys.filter(key => {
        switch (filter.status) {
          case 'active':
            return key.isActive;
          case 'inactive':
            return !key.isActive;
          case 'used':
            return key.users.length > 0;
          case 'unused':
            return key.users.length === 0;
          default:
            return true;
        }
      });
    }

    // Фильтр по поиску
    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      filteredKeys = filteredKeys.filter(key => {
        const keyMatch = key.key.toLowerCase().includes(searchTerm);
        const userMatch = key.users.some(user => 
          user.username?.toLowerCase().includes(searchTerm) ||
          user.firstName?.toLowerCase().includes(searchTerm) ||
          user.lastName?.toLowerCase().includes(searchTerm)
        );
        return keyMatch || userMatch;
      });
    }

    // Пагинация
    const totalKeys = filteredKeys.length;
    const totalPages = Math.ceil(totalKeys / (filter.limit || 5));
    const currentPage = filter.page || 1;
    const offset = ((currentPage - 1) * (filter.limit || 5));
    const paginatedKeys = filteredKeys.slice(offset, offset + (filter.limit || 5));

    // Удаляем сообщение о загрузке
    await ctx.deleteMessage(loadingMessage.message_id);

    // Формируем сообщение
    let message = `🔑 <b>Список ключей доступа</b>\n\n`;
    
    // Информация о фильтрах
    const statusLabels = {
      all: 'Все',
      active: 'Активные',
      inactive: 'Неактивные',
      used: 'Использованные',
      unused: 'Свободные'
    };
    
    message += `📊 <b>Фильтр:</b> ${statusLabels[filter.status || 'all']}\n`;
    if (filter.search) {
      message += `🔍 <b>Поиск:</b> "${filter.search}"\n`;
    }
    message += `📄 <b>Страница:</b> ${currentPage} из ${totalPages}\n`;
    message += `📈 <b>Найдено:</b> ${totalKeys} ключей\n\n`;

    if (paginatedKeys.length === 0) {
      message += '❌ Ключи не найдены.\n\n';
    } else {
      // Отображаем ключи
      paginatedKeys.forEach((key, index) => {
        const keyNumber = offset + index + 1;
        const statusIcon = key.isActive ? '✅' : '❌';
        const usageIcon = key.users.length > 0 ? '👤' : '🆓';
        
        message += `${keyNumber}. ${statusIcon} ${usageIcon} <code>${key.key}</code>\n`;
        message += `   📅 Создан: ${key.createdAt.toLocaleString('ru-RU')}\n`;
        
        if (key.users.length > 0) {
          const user = key.users[0]; // Берем первого пользователя (ключ может быть привязан только к одному)
          if (user) {
            const userName = user.username ? `@${user.username}` : 
                            `${user.firstName || ''} ${user.lastName || ''}`.trim() || 
                            `ID: ${user.telegramId}`;
            message += `   👤 Пользователь: ${userName}\n`;
            message += `   🕐 Активирован: ${key.usedAt?.toLocaleString('ru-RU') || 'Неизвестно'}\n`;
          }
        } else {
          message += `   🆓 Статус: Свободный ключ\n`;
        }
        message += '\n';
      });
    }

    // Создаем клавиатуру
    const keyboard = createKeysKeyboard(filter, totalPages, currentPage);

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });

    // Логируем просмотр списка ключей
    logger.info('Keys list viewed', {
      adminId: ctx.user?.id,
      filter,
      totalKeys,
      currentPage,
      totalPages
    });

  } catch (error) {
    logger.error('Error in showKeysList', {
      error: error instanceof Error ? error.message : 'Unknown error',
      filter
    });
    throw error;
  }
};

// Функция создания клавиатуры для управления списком
const createKeysKeyboard = (filter: KeysFilter, totalPages: number, currentPage: number) => {
  const keyboard = [];

  // Фильтры по статусу
  const statusRow1 = [
    {
      text: filter.status === 'all' ? '• Все' : 'Все',
      callback_data: `keys_filter_all_${currentPage}`
    },
    {
      text: filter.status === 'active' ? '• Активные' : 'Активные',
      callback_data: `keys_filter_active_${currentPage}`
    },
    {
      text: filter.status === 'inactive' ? '• Неактивные' : 'Неактивные',
      callback_data: `keys_filter_inactive_${currentPage}`
    }
  ];

  const statusRow2 = [
    {
      text: filter.status === 'used' ? '• Использованные' : 'Использованные',
      callback_data: `keys_filter_used_${currentPage}`
    },
    {
      text: filter.status === 'unused' ? '• Свободные' : 'Свободные',
      callback_data: `keys_filter_unused_${currentPage}`
    }
  ];

  keyboard.push(statusRow1, statusRow2);

  // Пагинация
  if (totalPages > 1) {
    const paginationRow = [];
    
    if (currentPage > 1) {
      paginationRow.push({
        text: '⬅️ Назад',
        callback_data: `keys_page_${currentPage - 1}_${filter.status || 'all'}`
      });
    }
    
    paginationRow.push({
      text: `${currentPage}/${totalPages}`,
      callback_data: 'keys_page_info'
    });
    
    if (currentPage < totalPages) {
      paginationRow.push({
        text: 'Вперед ➡️',
        callback_data: `keys_page_${currentPage + 1}_${filter.status || 'all'}`
      });
    }
    
    keyboard.push(paginationRow);
  }

  // Управляющие кнопки
  const controlRow1 = [
    {
      text: '🔍 Поиск',
      callback_data: 'keys_search'
    },
    {
      text: '🔄 Обновить',
      callback_data: `keys_refresh_${currentPage}_${filter.status || 'all'}`
    }
  ];

  const controlRow2 = [
    {
      text: '🔑 Создать ключ',
      callback_data: 'keys_create_new'
    },
    {
      text: '🗑️ Деактивировать',
      callback_data: 'keys_deactivate'
    }
  ];

  const controlRow3 = [
    {
      text: '❌ Закрыть',
      callback_data: 'keys_close'
    }
  ];

  keyboard.push(controlRow1, controlRow2, controlRow3);

  return keyboard;
};

// Обработчик callback-запросов для списка ключей
export const handleKeysCallbacks = async (ctx: BotContext, callbackData: string) => {
  try {
    const parts = callbackData.split('_');
    
    if (parts[0] !== 'keys') return;

    await ctx.answerCbQuery();

    switch (parts[1]) {
      case 'filter':
        const status = parts[2] as KeysFilter['status'];
        const pageStr = parts[3];
        const page = pageStr ? parseInt(pageStr) || 1 : 1;
        await ctx.deleteMessage();
        if (status) {
          await showKeysList(ctx, { status, page });
        }
        break;

      case 'page':
        const newPageStr = parts[2];
        const newPage = newPageStr ? parseInt(newPageStr) : 1;
        const filterStatus = parts[3] as KeysFilter['status'];
        await ctx.deleteMessage();
        if (filterStatus && newPageStr) {
          await showKeysList(ctx, { status: filterStatus, page: newPage });
        }
        break;

      case 'refresh':
        const refreshPageStr = parts[2];
        const refreshPage = refreshPageStr ? parseInt(refreshPageStr) || 1 : 1;
        const refreshStatus = parts[3] as KeysFilter['status'];
        await ctx.deleteMessage();
        if (refreshStatus && refreshPageStr) {
          await showKeysList(ctx, { status: refreshStatus, page: refreshPage });
        }
        break;

      case 'search':
        await ctx.deleteMessage();
        await ctx.reply('🔍 <b>Поиск по ключам</b>\n\nВведите текст для поиска по ключам или пользователям:', {
          parse_mode: 'HTML'
        });
        // Здесь нужно будет добавить обработку ввода поиска
        break;

      case 'create':
        if (parts[2] === 'new') {
          await ctx.deleteMessage();
          const { generateKeyHandler } = await import('./generateKey');
          await generateKeyHandler(ctx);
        }
        break;

      case 'deactivate':
        await ctx.deleteMessage();
        const { deactivateKeyHandler } = await import('./deactivateKey');
        await deactivateKeyHandler(ctx);
        break;

      case 'close':
        await ctx.deleteMessage();
        await ctx.reply('🔑 Список ключей закрыт.');
        break;

      default:
        await ctx.answerCbQuery('❌ Неизвестная команда');
        break;
    }

  } catch (error) {
    logger.error('Error in handleKeysCallbacks', {
      error: error instanceof Error ? error.message : 'Unknown error',
      callbackData,
      userId: ctx.user?.id
    });
    await ctx.answerCbQuery('❌ Произошла ошибка при обработке команды');
  }
};
