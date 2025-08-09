import { BotContext } from '../middleware/auth';
import { logger } from '../../utils/logger';

export const helpHandler = async (ctx: BotContext) => {
  try {
    // Определяем статус пользователя
    const isAuthenticated = !!ctx.user;
    const isAdmin = ctx.user?.isAdmin || false;

    let helpMessage = '';
    let replyMarkup: any = undefined;

    if (isAdmin) {
      // Справка для администраторов
      helpMessage = `🔧 <b>Справка для администратора</b>

Добро пожаловать в AI Chat Bot! Вы имеете права администратора.

📋 <b>Основные команды:</b>
• /help - Показать эту справку
• /start - Начать работу с ботом
• /clear - Очистить историю диалога
• /status - Показать статус бота и пользователя
• /balance - Проверить баланс системы

🔧 <b>Административные команды:</b>
• /admin - Открыть панель администратора
• /generate_key - Создать новый ключ доступа
• /list_keys - Показать все ключи доступа
• /deactivate_key - Деактивировать ключ доступа
• /list_users - Показать всех пользователей
• /user_stats - Статистика пользователя
• /analytics - Аналитика системы

💬 <b>Работа с AI:</b>
• Отправьте любое текстовое сообщение для общения с AI
• Отправьте файл или изображение для анализа

⚡ <b>Быстрый доступ:</b>`;

      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '🔧 Панель администратора',
              callback_data: 'help_admin_panel'
            }
          ],
          [
            {
              text: '🔑 Создать ключ',
              callback_data: 'help_generate_key'
            },
            {
              text: '📋 Список ключей',
              callback_data: 'help_list_keys'
            }
          ]
        ]
      };

    } else if (isAuthenticated) {
      // Справка для авторизованных пользователей
      helpMessage = `👤 <b>Справка для пользователя</b>

Добро пожаловать в AI Chat Bot! Вы успешно авторизованы.

📋 <b>Доступные команды:</b>
• /help - Показать эту справку
• /start - Начать работу с ботом
• /clear - Очистить историю диалога
• /status - Показать ваш статус

💬 <b>Как использовать бота:</b>
• Отправьте любое текстовое сообщение для общения с AI
• Задавайте вопросы, просите помощь или ведите диалог
• Отправьте файл или изображение для анализа

🤖 <b>Возможности AI:</b>
• Ответы на вопросы по любым темам
• Помощь с программированием
• Анализ текстов и документов
• Обработка изображений
• Творческие задачи

💡 <b>Советы:</b>
• Формулируйте вопросы четко и подробно
• Используйте /clear для начала нового диалога
• Бот запоминает контекст беседы`;

      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '📊 Мой статус',
              callback_data: 'help_status'
            },
            {
              text: '🗑️ Очистить историю',
              callback_data: 'help_clear'
            }
          ]
        ]
      };

    } else {
      // Справка для неавторизованных пользователей
      helpMessage = `🚪 <b>Добро пожаловать в AI Chat Bot!</b>

Для использования бота необходима авторизация.

🔑 <b>Как получить доступ:</b>
1. Получите ключ доступа у администратора
2. Используйте команду /start
3. Введите полученный ключ доступа
4. Начните общение с AI!

📋 <b>Доступные команды:</b>
• /help - Показать эту справку
• /start - Начать процесс авторизации

❓ <b>Нужна помощь?</b>
Обратитесь к администратору для получения ключа доступа.

🤖 <b>Что умеет бот после авторизации:</b>
• Отвечает на вопросы по любым темам
• Помогает с программированием и техническими задачами
• Анализирует тексты и документы
• Обрабатывает изображения
• Ведет диалог с сохранением контекста`;

      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '🚀 Начать авторизацию',
              callback_data: 'help_start_auth'
            }
          ]
        ]
      };
    }

    await ctx.reply(helpMessage, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    });

    // Логируем обращение к справке
    logger.info('Help command used', {
      userId: ctx.user?.id || 'anonymous',
      telegramId: ctx.from?.id,
      isAuthenticated,
      isAdmin,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error in helpHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });

    await ctx.reply('❌ Произошла ошибка при загрузке справки. Попробуйте еще раз позже.');
  }
};
