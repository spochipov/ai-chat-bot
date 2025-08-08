import { BotContext } from '../middleware/auth';
import { DatabaseService } from '../../services/database';
import { logger } from '../../utils/logger';

export const startHandler = async (ctx: BotContext) => {
  try {
    const telegramId = BigInt(ctx.from!.id);
    
    // Проверяем, существует ли пользователь в базе данных
    const existingUser = await DatabaseService.findUserByTelegramId(telegramId);
    
    if (existingUser) {
      // Пользователь уже зарегистрирован
      if (!existingUser.isActive) {
        await ctx.reply('❌ Ваш аккаунт деактивирован. Обратитесь к администратору для восстановления доступа.');
        return;
      }
      
      if (!existingUser.accessKey.isActive) {
        await ctx.reply('❌ Ваш ключ доступа деактивирован. Обратитесь к администратору для получения нового ключа.');
        return;
      }
      
      // Приветствуем существующего пользователя
      const welcomeMessage = `👋 Добро пожаловать обратно, ${existingUser.firstName || existingUser.username || 'пользователь'}!

🤖 Я AI чат-бот, готов помочь вам с различными задачами.

📋 *Доступные команды:*
• /help - Справка по командам
• /balance - Проверить баланс токенов
• /clear - Очистить историю сообщений
• /status - Статус аккаунта

${existingUser.isAdmin ? '\n🔧 *Команды администратора:*\n• /generate_key - Создать новый ключ доступа\n• /list_keys - Список всех ключей\n• /list_users - Список пользователей\n• /analytics - Аналитика использования' : ''}

💬 Просто отправьте мне сообщение, и я отвечу!`;

      await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
      
      logger.info('Existing user started bot', {
        userId: existingUser.id,
        telegramId: telegramId.toString(),
        username: existingUser.username
      });
      
      return;
    }
    
    // Новый пользователь - запрашиваем ключ доступа
    ctx.session.awaitingAccessKey = true;
    ctx.awaitingAccessKey = true;
    
    const registrationMessage = `🔐 *Добро пожаловать в AI чат-бот!*

Для начала работы вам необходим ключ доступа.

📝 *Как получить доступ:*
1. Получите ключ доступа от администратора
2. Отправьте ключ в следующем сообщении
3. После проверки ключа вы получите доступ к боту

🔑 Пожалуйста, отправьте ваш ключ доступа:`;

    await ctx.reply(registrationMessage, { parse_mode: 'Markdown' });
    
    logger.info('New user started registration process', {
      telegramId: telegramId.toString(),
      username: ctx.from?.username,
      firstName: ctx.from?.first_name
    });
    
  } catch (error) {
    logger.error('Error in startHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      telegramId: ctx.from?.id,
      username: ctx.from?.username
    });
    
    await ctx.reply('❌ Произошла ошибка при запуске бота. Попробуйте еще раз позже.');
  }
};

// Функция для обработки ключа доступа от нового пользователя
export const handleAccessKeyInput = async (ctx: BotContext, accessKey: string) => {
  try {
    const telegramId = BigInt(ctx.from!.id);
    
    // Проверяем формат ключа
    if (!accessKey.startsWith('ACK_') || accessKey.length !== 36) {
      await ctx.reply('❌ Неверный формат ключа доступа. Ключ должен начинаться с "ACK_" и содержать 36 символов.');
      return false;
    }
    
    // Ищем ключ в базе данных
    const foundKey = await DatabaseService.findAccessKeyByKey(accessKey);
    
    if (!foundKey) {
      await ctx.reply('❌ Ключ доступа не найден. Проверьте правильность ввода или обратитесь к администратору.');
      return false;
    }
    
    if (!foundKey.isActive) {
      await ctx.reply('❌ Данный ключ доступа деактивирован. Обратитесь к администратору для получения нового ключа.');
      return false;
    }
    
    // Проверяем, не использован ли уже ключ
    const existingUserWithKey = await DatabaseService.getClient().user.findFirst({
      where: { accessKeyId: foundKey.id }
    });
    
    if (existingUserWithKey) {
      await ctx.reply('❌ Данный ключ доступа уже используется другим пользователем.');
      return false;
    }
    
    // Создаем нового пользователя
    const userData: {
      telegramId: bigint;
      username?: string;
      firstName?: string;
      lastName?: string;
      accessKeyId: string;
      isAdmin?: boolean;
    } = {
      telegramId,
      accessKeyId: foundKey.id,
      isAdmin: false
    };

    if (ctx.from?.username) {
      userData.username = ctx.from.username;
    }
    if (ctx.from?.first_name) {
      userData.firstName = ctx.from.first_name;
    }
    if (ctx.from?.last_name) {
      userData.lastName = ctx.from.last_name;
    }

    const newUser = await DatabaseService.createUser(userData);
    
    // Обновляем ключ - отмечаем как использованный
    await DatabaseService.updateAccessKey(foundKey.id, {
      usedAt: new Date()
    });
    
    // Приветствуем нового пользователя
    const welcomeMessage = `✅ *Регистрация успешно завершена!*

👋 Добро пожаловать, ${newUser.firstName || newUser.username || 'пользователь'}!

🤖 Теперь у вас есть доступ к AI чат-боту.

📋 *Доступные команды:*
• /help - Справка по командам
• /balance - Проверить баланс токенов
• /clear - Очистить историю сообщений
• /status - Статус аккаунта

💬 Просто отправьте мне сообщение, и я отвечу!

🎉 Приятного использования!`;

    await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
    
    // Сбрасываем флаг ожидания ключа и сохраняем пользователя в сессии
    ctx.session.awaitingAccessKey = false;
    ctx.awaitingAccessKey = false;
    
    // Сохраняем пользователя в сессии
    ctx.session.user = {
      id: newUser.id,
      telegramId: newUser.telegramId,
      isAdmin: newUser.isAdmin,
      accessKeyId: newUser.accessKeyId
    };
    ctx.user = ctx.session.user;
    
    logger.info('New user registered successfully', {
      userId: newUser.id,
      telegramId: telegramId.toString(),
      username: newUser.username,
      accessKeyId: foundKey.id,
      accessKey: foundKey.key
    });
    
    return true;
    
  } catch (error) {
    logger.error('Error in handleAccessKeyInput', {
      error: error instanceof Error ? error.message : 'Unknown error',
      telegramId: ctx.from?.id,
      accessKey
    });
    
    await ctx.reply('❌ Произошла ошибка при обработке ключа доступа. Попробуйте еще раз позже.');
    return false;
  }
};
