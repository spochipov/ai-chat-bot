import { BotContext } from '../middleware/auth';
import { logger } from '../../utils/logger';
import { DatabaseService } from '../../services/database';
import { OpenRouterService, OpenRouterMessage } from '../../services/openrouter';

export const forwardHandler = async (ctx: BotContext) => {
  try {
    // Проверяем, авторизован ли пользователь
    if (!ctx.user) {
      await ctx.reply('❌ Вы не авторизованы. Используйте команду /start для начала работы.');
      return;
    }

    // Проверяем, что это пересылаемое сообщение
    if (!ctx.message || (!('forward_from' in ctx.message) && !('forward_from_chat' in ctx.message))) {
      await ctx.reply('❌ Это не пересылаемое сообщение.');
      return;
    }

    // Отправляем индикатор "печатает"
    await ctx.sendChatAction('typing');

    try {
      // Извлекаем информацию о пересылаемом сообщении
      const forwardInfo = extractForwardInfo(ctx);
      
      // Получаем содержимое сообщения
      const messageContent = extractMessageContent(ctx);
      
      if (!messageContent) {
        await ctx.reply('❌ Не удалось извлечь содержимое из пересылаемого сообщения. Поддерживаются только текстовые сообщения.');
        return;
      }

      // Формируем контекст для AI
      const promptText = `Пользователь переслал сообщение со следующей информацией:

📨 **Информация о пересылке:**
${forwardInfo}

📝 **Содержимое сообщения:**
${messageContent}

Пожалуйста, проанализируй это сообщение и дай полезный ответ или комментарий.`;

      // Сохраняем пересылаемое сообщение в базу данных
      const messageData: any = {
        userId: ctx.user.id,
        content: `[ПЕРЕСЫЛКА] ${forwardInfo}\n\nСодержимое: ${messageContent}`,
        role: 'USER',
      };
      
      if (ctx.message?.message_id) {
        messageData.messageId = ctx.message.message_id;
      }
      
      await DatabaseService.createMessage(messageData);

      // Получаем историю сообщений для контекста
      const maxContextMessages = parseInt(
        (await DatabaseService.getSetting('max_context_messages'))?.value || '20'
      );
      
      const recentMessages = await DatabaseService.getUserMessages(
        ctx.user.id,
        maxContextMessages
      );

      // Формируем контекст для OpenRouter
      const messages: OpenRouterMessage[] = [];
      
      // Добавляем системное сообщение
      messages.push({
        role: 'system',
        content: `Ты полезный AI-ассистент. Отвечай на русском языке, если пользователь пишет на русском. Будь дружелюбным и информативным. Пользователь переслал сообщение для анализа или комментария. Дай содержательный ответ.`
      });

      // Добавляем историю сообщений (исключая текущее пересылаемое)
      recentMessages.reverse().slice(0, -1).forEach(msg => {
        messages.push({
          role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
          content: msg.content
        });
      });

      // Добавляем текущий запрос
      messages.push({
        role: 'user',
        content: promptText
      });

      // Отправляем запрос в OpenRouter
      const response = await OpenRouterService.sendMessage(messages);

      // Отправляем ответ пользователю
      const responseText = `📨 <b>Анализ пересылаемого сообщения</b>\n\n${forwardInfo}\n\n🤖 <b>Ответ ассистента:</b>\n${response.content}`;

      // Разбиваем длинные сообщения на части
      const maxMessageLength = 4000;
      if (responseText.length <= maxMessageLength) {
        await ctx.reply(responseText, { parse_mode: 'HTML' });
      } else {
        // Отправляем информацию о пересылке
        const forwardInfoText = `📨 <b>Анализ пересылаемого сообщения</b>\n\n${forwardInfo}`;
        await ctx.reply(forwardInfoText, { parse_mode: 'HTML' });
        
        // Отправляем ответ ассистента отдельно
        await ctx.reply(`🤖 <b>Ответ ассистента:</b>\n${response.content}`, { parse_mode: 'HTML' });
      }

      // Сохраняем ответ ассистента в базу данных
      const assistantMessageData: any = {
        userId: ctx.user.id,
        content: response.content,
        role: 'ASSISTANT',
        tokens: response.usage.totalTokens,
        cost: OpenRouterService.calculateCost(
          response.usage.promptTokens,
          response.usage.completionTokens,
          response.model
        ),
      };
      
      await DatabaseService.createMessage(assistantMessageData);

      // Сохраняем статистику использования
      await DatabaseService.createUsage({
        userId: ctx.user.id,
        tokens: response.usage.totalTokens,
        cost: OpenRouterService.calculateCost(
          response.usage.promptTokens,
          response.usage.completionTokens,
          response.model
        ),
        model: response.model,
        requestType: 'forward',
      });

      logger.info('Forward message processed successfully', {
        userId: ctx.user.id,
        telegramId: ctx.user.telegramId.toString(),
        messageLength: messageContent.length,
        responseLength: response.content.length,
        tokens: response.usage.totalTokens,
        model: response.model,
        forwardFrom: ('forward_from' in ctx.message) ? 'user' : 'chat',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error processing forward message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: ctx.user.id,
        telegramId: ctx.user.telegramId.toString()
      });

      // Отправляем пользователю информативное сообщение об ошибке
      let errorMessage = '❌ Произошла ошибка при обработке пересылаемого сообщения.';
      
      if (error instanceof Error) {
        if (error.message.includes('Rate limit')) {
          errorMessage = '⏱️ Превышен лимит запросов. Попробуйте через несколько минут.';
        } else if (error.message.includes('Invalid OpenRouter API key')) {
          errorMessage = '🔑 Ошибка конфигурации API. Обратитесь к администратору.';
        } else if (error.message.includes('service is temporarily unavailable')) {
          errorMessage = '🔧 Сервис временно недоступен. Попробуйте позже.';
        }
      }

      await ctx.reply(errorMessage);
    }
    
  } catch (error) {
    logger.error('Error in forwardHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });
    
    await ctx.reply('❌ Произошла неожиданная ошибка при обработке пересылаемого сообщения. Попробуйте еще раз позже.');
  }
};

// Функция для извлечения информации о пересылке
function extractForwardInfo(ctx: BotContext): string {
  if (!ctx.message) return 'Неизвестно';

  let info = '';

  if ('forward_from' in ctx.message && ctx.message.forward_from) {
    // Пересылка от пользователя
    const user = ctx.message.forward_from as any;
    const userName = user.username ? `@${user.username}` : 
                    `${user.first_name || ''} ${user.last_name || ''}`.trim() || 
                    `ID: ${user.id}`;
    info = `👤 От пользователя: ${userName}`;
  } else if ('forward_from_chat' in ctx.message && ctx.message.forward_from_chat) {
    // Пересылка из чата/канала
    const chat = ctx.message.forward_from_chat as any;
    const chatName = chat.title || `ID: ${chat.id}`;
    const chatType = chat.type === 'channel' ? 'канала' : 
                     chat.type === 'group' ? 'группы' : 
                     chat.type === 'supergroup' ? 'супергруппы' : 'чата';
    info = `💬 Из ${chatType}: ${chatName}`;
    
    if (chat.username) {
      info += ` (@${chat.username})`;
    }
  }

  // Добавляем дату пересылки, если доступна
  if ('forward_date' in ctx.message && ctx.message.forward_date) {
    const forwardDate = new Date((ctx.message.forward_date as number) * 1000);
    info += `\n📅 Дата оригинала: ${forwardDate.toLocaleString('ru-RU')}`;
  }

  return info;
}

// Функция для извлечения содержимого сообщения
function extractMessageContent(ctx: BotContext): string | null {
  if (!ctx.message) return null;

  // Текстовое сообщение
  if ('text' in ctx.message && ctx.message.text) {
    return ctx.message.text;
  }

  // Сообщение с подписью
  if ('caption' in ctx.message && ctx.message.caption) {
    let content = ctx.message.caption;
    
    // Добавляем информацию о типе медиа
    if ('photo' in ctx.message) {
      content = `[ФОТО]\n${content}`;
    } else if ('video' in ctx.message) {
      content = `[ВИДЕО]\n${content}`;
    } else if ('document' in ctx.message) {
      content = `[ДОКУМЕНТ]\n${content}`;
    } else if ('voice' in ctx.message) {
      content = `[ГОЛОСОВОЕ СООБЩЕНИЕ]\n${content}`;
    } else if ('audio' in ctx.message) {
      content = `[АУДИО]\n${content}`;
    }
    
    return content;
  }

  // Медиа без подписи
  if ('photo' in ctx.message) {
    return '[ФОТО без подписи]';
  } else if ('video' in ctx.message) {
    return '[ВИДЕО без подписи]';
  } else if ('document' in ctx.message) {
    const doc = ctx.message.document;
    return `[ДОКУМЕНТ: ${doc.file_name || 'без названия'}]`;
  } else if ('voice' in ctx.message) {
    const voice = ctx.message.voice;
    return `[ГОЛОСОВОЕ СООБЩЕНИЕ: ${voice.duration || 0} сек.]`;
  } else if ('audio' in ctx.message) {
    const audio = ctx.message.audio;
    return `[АУДИО: ${audio.title || audio.file_name || 'без названия'}]`;
  } else if ('sticker' in ctx.message) {
    const sticker = ctx.message.sticker;
    return `[СТИКЕР: ${sticker.emoji || ''}]`;
  } else if ('location' in ctx.message) {
    const loc = ctx.message.location;
    return `[ГЕОЛОКАЦИЯ: ${loc.latitude}, ${loc.longitude}]`;
  } else if ('contact' in ctx.message) {
    const contact = ctx.message.contact;
    return `[КОНТАКТ: ${contact.first_name} ${contact.last_name || ''} ${contact.phone_number}]`;
  }

  return '[НЕПОДДЕРЖИВАЕМЫЙ ТИП СООБЩЕНИЯ]';
}
