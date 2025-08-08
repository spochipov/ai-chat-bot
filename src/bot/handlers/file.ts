import { BotContext } from '../middleware/auth';
import { logger } from '../../utils/logger';
import { DatabaseService } from '../../services/database';
import { OpenRouterService, OpenRouterMessage } from '../../services/openrouter';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export const fileHandler = async (ctx: BotContext) => {
  try {
    // Проверяем авторизацию
    if (!ctx.user) {
      await ctx.reply('❌ Вы не авторизованы. Используйте команду /start для начала работы.');
      return;
    }

    // Отправляем индикатор "печатает"
    await ctx.sendChatAction('typing');

    let fileId: string | undefined;
    let fileName: string | undefined;
    let fileSize: number | undefined;
    let mimeType: string | undefined;

    // Определяем тип файла
    if (ctx.message && 'document' in ctx.message && ctx.message.document) {
      const doc = ctx.message.document;
      fileId = doc.file_id;
      fileName = doc.file_name || 'document';
      fileSize = doc.file_size;
      mimeType = doc.mime_type;
    } else if (ctx.message && 'photo' in ctx.message && ctx.message.photo && ctx.message.photo.length > 0) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Берем самое большое фото
      if (photo) {
        fileId = photo.file_id;
        fileName = 'photo.jpg';
        fileSize = photo.file_size;
        mimeType = 'image/jpeg';
      }
    } else {
      await ctx.reply('❌ Неподдерживаемый тип файла.');
      return;
    }

    if (!fileId) {
      await ctx.reply('❌ Не удалось получить файл.');
      return;
    }

    // Проверяем размер файла
    const maxFileSize = parseInt(process.env['MAX_FILE_SIZE'] || '20971520'); // 20MB по умолчанию
    if (fileSize && fileSize > maxFileSize) {
      await ctx.reply(`❌ Файл слишком большой. Максимальный размер: ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return;
    }

    // Проверяем тип файла
    const allowedTypes = (process.env['ALLOWED_FILE_TYPES'] || 'txt,pdf,docx,jpg,jpeg,png,gif,webp').split(',');
    const fileExtension = fileName?.split('.').pop()?.toLowerCase();
    
    if (!fileExtension || !allowedTypes.includes(fileExtension)) {
      await ctx.reply(`❌ Неподдерживаемый тип файла. Разрешены: ${allowedTypes.join(', ')}`);
      return;
    }

    try {
      // Получаем файл от Telegram
      const fileLink = await ctx.telegram.getFileLink(fileId);
      const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
      const fileBuffer = Buffer.from(response.data);

      // Сохраняем файл локально
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const localFileName = `${timestamp}_${fileName}`;
      const localFilePath = path.join(uploadsDir, localFileName);
      fs.writeFileSync(localFilePath, fileBuffer);

      // Обрабатываем файл в зависимости от типа
      let fileContent = '';
      let prompt = 'Проанализируй этот файл и предоставь подробное описание его содержимого.';

      // Получаем текст сообщения пользователя (если есть)
      const userMessage = ctx.message && 'caption' in ctx.message ? ctx.message.caption : '';
      if (userMessage) {
        prompt = userMessage;
      }

      if (mimeType?.startsWith('image/')) {
        // Обработка изображений
        await ctx.sendChatAction('typing');
        
        // Конвертируем изображение в base64 для отправки в OpenRouter
        const imageBase64 = fileBuffer.toString('base64');
        const imageUrl = `data:${mimeType};base64,${imageBase64}`;

        // Используем модель с поддержкой изображений
        const messages: OpenRouterMessage[] = [
          {
            role: 'system',
            content: 'Ты AI-ассистент, который анализирует изображения. Отвечай на русском языке подробно и информативно.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ];

        const response = await OpenRouterService.sendMessage(messages, {
          model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o'
        });

        await sendMessageWithFallback(ctx, response.content);

        // Сохраняем в базу данных
        await saveFileMessage(ctx, prompt, response, localFilePath, localFileName, mimeType);

      } else if (mimeType === 'application/pdf') {
        // Обработка PDF файлов
        await ctx.sendChatAction('typing');
        
        const pdfData = await pdfParse(fileBuffer);
        fileContent = pdfData.text;

        if (!fileContent.trim()) {
          await ctx.reply('❌ Не удалось извлечь текст из PDF файла.');
          return;
        }

        await processTextContent(ctx, prompt, fileContent, localFilePath, localFileName, mimeType);

      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // Обработка DOCX файлов
        await ctx.sendChatAction('typing');
        
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        fileContent = result.value;

        if (!fileContent.trim()) {
          await ctx.reply('❌ Не удалось извлечь текст из DOCX файла.');
          return;
        }

        await processTextContent(ctx, prompt, fileContent, localFilePath, localFileName, mimeType);

      } else if (mimeType === 'text/plain' || fileExtension === 'txt') {
        // Обработка текстовых файлов
        await ctx.sendChatAction('typing');
        
        fileContent = fileBuffer.toString('utf-8');

        if (!fileContent.trim()) {
          await ctx.reply('❌ Файл пуст или не содержит текста.');
          return;
        }

        await processTextContent(ctx, prompt, fileContent, localFilePath, localFileName, mimeType);

      } else {
        await ctx.reply('❌ Неподдерживаемый тип файла для обработки.');
        return;
      }

      logger.info('File processed successfully', {
        userId: ctx.user.id,
        telegramId: ctx.user.telegramId.toString(),
        fileName,
        fileSize,
        mimeType,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error processing file', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: ctx.user.id,
        telegramId: ctx.user.telegramId.toString(),
        fileName
      });

      let errorMessage = '❌ Произошла ошибка при обработке файла.';
      
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
    logger.error('Error in fileHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });
    
    await ctx.reply('❌ Произошла неожиданная ошибка при обработке файла.');
  }
};

// Функция для обработки текстового содержимого
async function processTextContent(
  ctx: BotContext, 
  prompt: string, 
  content: string, 
  filePath: string, 
  fileName: string, 
  mimeType: string | undefined
) {
  // Ограничиваем размер контента для отправки в API
  const maxContentLength = 50000; // ~50KB текста
  let processedContent = content;
  
  if (content.length > maxContentLength) {
    processedContent = content.substring(0, maxContentLength) + '\n\n[... содержимое обрезано из-за большого размера ...]';
  }

  const messages: OpenRouterMessage[] = [
    {
      role: 'system',
      content: 'Ты AI-ассистент, который анализирует документы. Отвечай на русском языке подробно и информативно.'
    },
    {
      role: 'user',
      content: `${prompt}\n\nСодержимое файла "${fileName}":\n\n${processedContent}`
    }
  ];

  const response = await OpenRouterService.sendMessage(messages);
  await sendMessageWithFallback(ctx, response.content);

  // Сохраняем в базу данных
  await saveFileMessage(ctx, prompt, response, filePath, fileName, mimeType);
}

// Функция для сохранения сообщения с файлом в базу данных
async function saveFileMessage(
  ctx: BotContext,
  userPrompt: string,
  response: any,
  filePath: string,
  fileName: string,
  mimeType: string | undefined
) {
  if (!ctx.user) return;

  // Сохраняем сообщение пользователя
  const userMessageData: any = {
    userId: ctx.user.id,
    content: userPrompt || 'Файл для анализа',
    role: 'USER',
    fileUrl: filePath,
    fileName,
    fileType: mimeType,
  };
  
  if (ctx.message?.message_id) {
    userMessageData.messageId = ctx.message.message_id;
  }
  
  await DatabaseService.createMessage(userMessageData);

  // Сохраняем ответ ассистента
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
    requestType: 'file',
  });
}

// Функция для отправки сообщения с fallback (импортируем из message.ts)
async function sendMessageWithFallback(ctx: BotContext, text: string): Promise<void> {
  try {
    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (error) {
    if (error instanceof Error && error.message.includes("can't parse entities")) {
      logger.warn('Markdown parsing failed, sending as plain text', {
        error: error.message,
        textLength: text.length
      });
      await ctx.reply(text);
    } else {
      throw error;
    }
  }
}
