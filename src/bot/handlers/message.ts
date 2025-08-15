import { BotContext } from '../middleware/auth';
import { handleAccessKeyInput } from './start';
import { logger } from '../../utils/logger';
import { DatabaseService } from '../../services/database';
import { AIService, AIMessage } from '../../services/ai';
import fs from 'fs';
import path from 'path';

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
    
    // Получаем текст сообщения
    const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    
    if (!messageText) {
      await ctx.reply('❌ Пожалуйста, отправьте текстовое сообщение.');
      return;
    }

    // Отправляем индикатор "печатает"
    await ctx.sendChatAction('typing');

    try {
      // Сохраняем сообщение пользователя в базу данных
      const messageData: any = {
        userId: ctx.user.id,
        content: messageText,
        role: 'USER',
      };
      
      if (ctx.message?.message_id) {
        messageData.messageId = ctx.message.message_id;
      }
      
      await DatabaseService.createMessage(messageData);

      // Получаем историю сообщений пользователя для контекста
      const maxContextMessages = parseInt(
        (await DatabaseService.getSetting('max_context_messages'))?.value || '20'
      );
      
      const recentMessages = await DatabaseService.getUserMessages(
        ctx.user.id,
        maxContextMessages
      );

      // Формируем контекст для AI сервиса
      const messages: AIMessage[] = [];
      
      // Добавляем системное сообщение
      messages.push({
        role: 'system',
        content: `Ты полезный AI-ассистент. Отвечай на русском языке, если пользователь пишет на русском. Будь дружелюбным и информативным. Если нужно создать файл в ответе, укажи это в своем ответе.`
      });

      // Добавляем историю сообщений (в обратном порядке, так как они отсортированы по убыванию даты)
      recentMessages.reverse().forEach(msg => {
        messages.push({
          role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
          content: msg.content
        });
      });

      // Отправляем запрос в AI сервис
      const response = await AIService.sendMessage(messages);

      // Проверяем, нужно ли создать файл
      const shouldCreateFile = response.content.length > 4000 || 
                              response.content.includes('```') ||
                              response.content.toLowerCase().includes('создам файл') ||
                              response.content.toLowerCase().includes('сохраню в файл');

      let fileUrl: string | undefined;
      let fileName: string | undefined;
      let fileType: string | undefined;

      if (shouldCreateFile) {
        // Создаем файл с ответом
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        fileName = `response_${timestamp}.txt`;
        const filePath = path.join(process.cwd(), 'uploads', fileName);
        
        // Убеждаемся, что папка uploads существует
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Записываем файл
        fs.writeFileSync(filePath, response.content, 'utf8');
        
        fileUrl = filePath;
        fileType = 'text/plain';

        // Отправляем файл пользователю
        const caption = `📄 Ответ сохранен в файл из-за большого размера\n\n💬 Краткое содержание:\n${response.content.substring(0, 500)}${response.content.length > 500 ? '...' : ''}`;
        
        try {
          await ctx.replyWithDocument(
            { source: filePath, filename: fileName },
            {
              caption,
              parse_mode: 'Markdown'
            }
          );
        } catch (error) {
          // Если ошибка парсинга Markdown в caption, отправляем без разметки
          if (error instanceof Error && error.message.includes("can't parse entities")) {
            await ctx.replyWithDocument(
              { source: filePath, filename: fileName },
              { caption }
            );
          } else {
            throw error;
          }
        }
      } else {
        // Отправляем обычный текстовый ответ
        // Разбиваем длинные сообщения на части (лимит Telegram ~4096 символов)
        const maxMessageLength = 4000;
        if (response.content.length <= maxMessageLength) {
          await sendMessageWithFallback(ctx, response.content);
        } else {
          const chunks = splitMessage(response.content, maxMessageLength);
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const prefix = i === 0 ? '' : `📄 Часть ${i + 1}/${chunks.length}:\n\n`;
            await sendMessageWithFallback(ctx, prefix + chunk);
            
            // Небольшая задержка между сообщениями
            if (i < chunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
      }

      // Сохраняем ответ ассистента в базу данных
      const assistantMessageData: any = {
        userId: ctx.user.id,
        content: response.content,
        role: 'ASSISTANT',
        tokens: response.usage.totalTokens,
        cost: AIService.calculateCost(
          response.usage.promptTokens,
          response.usage.completionTokens,
          response.model,
          response.provider
        ),
      };
      
      if (fileUrl) {
        assistantMessageData.fileUrl = fileUrl;
      }
      if (fileName) {
        assistantMessageData.fileName = fileName;
      }
      if (fileType) {
        assistantMessageData.fileType = fileType;
      }
      
      await DatabaseService.createMessage(assistantMessageData);

      // Сохраняем статистику использования
      await DatabaseService.createUsage({
        userId: ctx.user.id,
        tokens: response.usage.totalTokens,
        cost: AIService.calculateCost(
          response.usage.promptTokens,
          response.usage.completionTokens,
          response.model,
          response.provider
        ),
        model: response.model,
        requestType: 'text',
      });

      logger.info('Message processed successfully', {
        userId: ctx.user.id,
        telegramId: ctx.user.telegramId.toString(),
        messageLength: messageText.length,
        responseLength: response.content.length,
        tokens: response.usage.totalTokens,
        model: response.model,
        fileCreated: !!fileUrl,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error processing message with OpenRouter', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: ctx.user.id,
        telegramId: ctx.user.telegramId.toString(),
        messageText: messageText.substring(0, 100)
      });

      // Отправляем пользователю информативное сообщение об ошибке
      let errorMessage = '❌ Произошла ошибка при обработке вашего сообщения.';
      
      if (error instanceof Error) {
        if (error.message.includes('Rate limit')) {
          errorMessage = '⏱️ Превышен лимит запросов. Попробуйте через несколько минут.';
        } else if (error.message.includes('Invalid OpenRouter API key')) {
          errorMessage = '🔑 Ошибка конфигурации API. Обратитесь к администратору.';
        } else if (error.message.includes('service is temporarily unavailable')) {
          errorMessage = '🔧 Сервис временно недоступен. Попробуйте позже.';
        } else if (error.message.includes('Bad request')) {
          errorMessage = '📝 Некорректный запрос. Попробуйте переформулировать сообщение.';
        }
      }

      await ctx.reply(errorMessage);
    }
    
  } catch (error) {
    logger.error('Error in messageHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });
    
    await ctx.reply('❌ Произошла неожиданная ошибка. Попробуйте еще раз позже.');
  }
};

// Функция для отправки сообщения с fallback на обычный текст при ошибке парсинга Markdown
async function sendMessageWithFallback(ctx: BotContext, text: string): Promise<void> {
  try {
    // Сначала пытаемся отправить с Markdown
    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (error) {
    // Если ошибка парсинга Markdown, отправляем как обычный текст
    if (error instanceof Error && error.message.includes("can't parse entities")) {
      logger.warn('Markdown parsing failed, sending as plain text', {
        error: error.message,
        textLength: text.length
      });
      await ctx.reply(text);
    } else {
      // Если другая ошибка, пробрасываем дальше
      throw error;
    }
  }
}

// Функция для разбивки длинных сообщений на части
function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  const lines = text.split('\n');

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 <= maxLength) {
      currentChunk += (currentChunk ? '\n' : '') + line;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // Если строка сама по себе длиннее лимита, разбиваем ее
      if (line.length > maxLength) {
        const words = line.split(' ');
        let currentLine = '';
        
        for (const word of words) {
          if (currentLine.length + word.length + 1 <= maxLength) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            if (currentLine) {
              chunks.push(currentLine);
              currentLine = word;
            } else {
              // Слово само по себе длиннее лимита
              chunks.push(word.substring(0, maxLength));
              currentLine = word.substring(maxLength);
            }
          }
        }
        
        if (currentLine) {
          currentChunk = currentLine;
        }
      } else {
        currentChunk = line;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
