import { BotContext } from '../middleware/auth';
import { OpenRouterService } from '../../services/openrouter';
import { DatabaseService } from '../../services/database';
import { logger } from '../../utils/logger';

export const balanceHandler = async (ctx: BotContext) => {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ Ошибка: Данные пользователя не найдены.');
      return;
    }

    const loadingMessage = await ctx.reply('🔄 Загружаем информацию о балансе...');

    try {
      // Получаем баланс от OpenRouter
      const openRouterBalance = await OpenRouterService.getBalance();
      
      // Получаем общую статистику использования из базы данных
      const totalUsage = await DatabaseService.getTotalUsage();
      
      // Получаем статистику за последние 30 дней
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const monthlyUsage = await DatabaseService.getTotalUsage(thirtyDaysAgo);
      
      // Получаем статистику за сегодня
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayUsage = await DatabaseService.getTotalUsage(today);

      // Удаляем сообщение о загрузке
      await ctx.deleteMessage(loadingMessage.message_id);

      // Безопасно извлекаем данные баланса
      const credits = openRouterBalance.credits || 0;
      const usage = openRouterBalance.usage || 0;
      const remaining = credits - usage;

      // Формируем сообщение с балансом
      const balanceMessage = `💰 <b>Баланс системы</b>

🔑 <b>OpenRouter API:</b>
💳 Кредиты: $${credits.toFixed(4)}
📊 Использовано: $${usage.toFixed(4)}
💵 Остаток: $${remaining.toFixed(4)}

📈 <b>Статистика использования:</b>

📅 <b>За сегодня:</b>
🎯 Запросов: ${todayUsage._count.id || 0}
🔤 Токенов: ${todayUsage._sum.tokens || 0}
💸 Стоимость: $${(todayUsage._sum.cost || 0).toFixed(4)}

📆 <b>За 30 дней:</b>
🎯 Запросов: ${monthlyUsage._count.id || 0}
🔤 Токенов: ${monthlyUsage._sum.tokens || 0}
💸 Стоимость: $${(monthlyUsage._sum.cost || 0).toFixed(4)}

📊 <b>Всего за время работы:</b>
🎯 Запросов: ${totalUsage._count.id || 0}
🔤 Токенов: ${totalUsage._sum.tokens || 0}
💸 Стоимость: $${(totalUsage._sum.cost || 0).toFixed(4)}

⚡ <b>Средняя стоимость запроса:</b>
📅 Сегодня: $${todayUsage._count.id ? ((todayUsage._sum.cost || 0) / todayUsage._count.id).toFixed(6) : '0.000000'}
📆 За месяц: $${monthlyUsage._count.id ? ((monthlyUsage._sum.cost || 0) / monthlyUsage._count.id).toFixed(6) : '0.000000'}
📊 Общая: $${totalUsage._count.id ? ((totalUsage._sum.cost || 0) / totalUsage._count.id).toFixed(6) : '0.000000'}`;

      // Определяем статус баланса
      let statusIcon = '✅';
      let statusMessage = '';

      if (remaining < 1) {
        statusIcon = '🔴';
        statusMessage = '\n\n🚨 <b>Внимание!</b> Баланс критически низкий!';
      } else if (remaining < 5) {
        statusIcon = '🟡';
        statusMessage = '\n\n⚠️ <b>Предупреждение:</b> Баланс становится низким.';
      } else if (remaining < 10) {
        statusIcon = '🟠';
        statusMessage = '\n\n💡 <b>Информация:</b> Рекомендуется пополнить баланс.';
      }

      const finalMessage = `${statusIcon} ${balanceMessage}${statusMessage}`;

      await ctx.reply(finalMessage, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔄 Обновить',
                callback_data: 'balance_refresh'
              },
              {
                text: '📊 Детальная статистика',
                callback_data: 'balance_detailed'
              }
            ],
            [
              {
                text: '👥 Статистика пользователей',
                callback_data: 'balance_users_stats'
              }
            ],
            [
              {
                text: '❌ Закрыть',
                callback_data: 'balance_close'
              }
            ]
          ]
        }
      });

      // Логируем проверку баланса
      logger.info('Balance checked', {
        adminId: ctx.user.id,
        openRouterCredits: credits,
        openRouterUsage: usage,
        remainingBalance: remaining,
        totalRequests: totalUsage._count.id,
        totalCost: totalUsage._sum.cost,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // Удаляем сообщение о загрузке в случае ошибки
      try {
        await ctx.deleteMessage(loadingMessage.message_id);
      } catch (deleteError) {
        // Игнорируем ошибки удаления сообщения
      }

      logger.error('Failed to get balance information', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: ctx.user.id,
        telegramId: ctx.user.telegramId.toString()
      });

      await ctx.reply('❌ Ошибка при получении информации о балансе. Возможные причины:\n\n• Проблемы с подключением к OpenRouter API\n• Неверный API ключ\n• Временные проблемы сервиса\n\nПопробуйте еще раз позже.');
    }

  } catch (error) {
    logger.error('Error in balanceHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.reply('❌ Произошла неожиданная ошибка. Попробуйте еще раз позже.');
  }
};

// Обработчик callback-запросов для баланса
export const handleBalanceCallbacks = async (ctx: BotContext, callbackData: string) => {
  try {
    const parts = callbackData.split('_');
    
    if (parts[0] !== 'balance') return;

    await ctx.answerCbQuery();

    switch (parts[1]) {
      case 'refresh':
        await ctx.deleteMessage();
        await balanceHandler(ctx);
        break;

      case 'detailed':
        await ctx.deleteMessage();
        await showDetailedStats(ctx);
        break;

      case 'users':
        if (parts[2] === 'stats') {
          await ctx.deleteMessage();
          await showUsersStats(ctx);
        }
        break;

      case 'close':
        await ctx.deleteMessage();
        await ctx.reply('💰 Информация о балансе закрыта.');
        break;

      default:
        await ctx.answerCbQuery('❌ Неизвестная команда');
        break;
    }

  } catch (error) {
    logger.error('Error in handleBalanceCallbacks', {
      error: error instanceof Error ? error.message : 'Unknown error',
      callbackData,
      userId: ctx.user?.id
    });
    await ctx.answerCbQuery('❌ Произошла ошибка при обработке команды');
  }
};

// Функция показа детальной статистики
const showDetailedStats = async (ctx: BotContext) => {
  try {
    const loadingMessage = await ctx.reply('🔄 Загружаем детальную статистику...');

    // Получаем статистику за разные периоды
    const periods = [
      { name: 'Сегодня', days: 0 },
      { name: 'Вчера', days: 1 },
      { name: '7 дней', days: 7 },
      { name: '30 дней', days: 30 },
      { name: '90 дней', days: 90 }
    ];

    const stats = [];
    for (const period of periods) {
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (period.days === 0) {
        // Сегодня
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
      } else if (period.days === 1) {
        // Вчера
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Другие периоды
        startDate = new Date();
        startDate.setDate(startDate.getDate() - period.days);
      }

      const usage = await DatabaseService.getTotalUsage(startDate, endDate);
      stats.push({
        period: period.name,
        requests: usage._count.id || 0,
        tokens: usage._sum.tokens || 0,
        cost: usage._sum.cost || 0
      });
    }

    await ctx.deleteMessage(loadingMessage.message_id);

    let message = `📊 <b>Детальная статистика использования</b>\n\n`;

    stats.forEach(stat => {
      const avgCost = stat.requests > 0 ? (stat.cost / stat.requests).toFixed(6) : '0.000000';
      message += `📅 <b>${stat.period}:</b>\n`;
      message += `   🎯 Запросов: ${stat.requests}\n`;
      message += `   🔤 Токенов: ${stat.tokens}\n`;
      message += `   💸 Стоимость: $${stat.cost.toFixed(4)}\n`;
      message += `   📈 Средняя: $${avgCost}\n\n`;
    });

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔙 Назад к балансу',
              callback_data: 'balance_refresh'
            }
          ],
          [
            {
              text: '❌ Закрыть',
              callback_data: 'balance_close'
            }
          ]
        ]
      }
    });

  } catch (error) {
    logger.error('Error in showDetailedStats', error);
    await ctx.reply('❌ Ошибка при загрузке детальной статистики.');
  }
};

// Функция показа статистики пользователей
const showUsersStats = async (ctx: BotContext) => {
  try {
    const loadingMessage = await ctx.reply('🔄 Загружаем статистику пользователей...');

    // Получаем всех пользователей с их статистикой
    const users = await DatabaseService.getAllUsers();
    
    // Получаем активных пользователей за последние 30 дней
    const activeUsersCount = await DatabaseService.getActiveUsersCount(30);

    await ctx.deleteMessage(loadingMessage.message_id);

    let message = `👥 <b>Статистика пользователей</b>\n\n`;
    message += `📊 <b>Общая информация:</b>\n`;
    message += `👤 Всего пользователей: ${users.length}\n`;
    message += `✅ Активных (30 дней): ${activeUsersCount}\n`;
    message += `🔧 Администраторов: ${users.filter(u => u.isAdmin).length}\n\n`;

    // Топ-5 пользователей по количеству сообщений
    const topUsers = users
      .filter(u => u._count.messages > 0)
      .sort((a, b) => b._count.messages - a._count.messages)
      .slice(0, 5);

    if (topUsers.length > 0) {
      message += `🏆 <b>Топ пользователей по активности:</b>\n`;
      topUsers.forEach((user, index) => {
        const userName = user.username ? `@${user.username}` : 
                        `${user.firstName || ''} ${user.lastName || ''}`.trim() || 
                        `ID: ${user.telegramId}`;
        message += `${index + 1}. ${userName}\n`;
        message += `   💬 Сообщений: ${user._count.messages}\n`;
        message += `   📊 Запросов: ${user._count.usage}\n\n`;
      });
    }

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔙 Назад к балансу',
              callback_data: 'balance_refresh'
            }
          ],
          [
            {
              text: '❌ Закрыть',
              callback_data: 'balance_close'
            }
          ]
        ]
      }
    });

  } catch (error) {
    logger.error('Error in showUsersStats', error);
    await ctx.reply('❌ Ошибка при загрузке статистики пользователей.');
  }
};
