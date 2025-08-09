import { BotContext } from '../middleware/auth';
import { logger } from '../../utils/logger';
import { DatabaseService } from '../../services/database';

export const audioHandler = async (ctx: BotContext) => {
  try {
    // Проверяем, авторизован ли пользователь
    if (!ctx.user) {
      await ctx.reply('❌ Вы не авторизованы. Используйте команду /start для начала работы.');
      return;
    }

    // Проверяем наличие аудио в сообщении
    if (!ctx.message || !('voice' in ctx.message) && !('audio' in ctx.message)) {
      await ctx.reply('❌ Аудиосообщение не найдено.');
      return;
    }

    // Получаем информацию о файле
    const audioFile = 'voice' in ctx.message ? ctx.message.voice : ctx.message.audio;
    
    if (!audioFile) {
      await ctx.reply('❌ Не удалось получить информацию об аудиофайле.');
      return;
    }

    // Формируем информацию о файле
    const audioInfo = {
      duration: audioFile.duration || 0,
      fileSize: audioFile.file_size || 0,
      mimeType: audioFile.mime_type || 'audio/ogg',
      isVoice: 'voice' in ctx.message
    };

    // Сохраняем информацию об аудиосообщении в базу данных
    const messageData: any = {
      userId: ctx.user.id,
      content: `[АУДИОСООБЩЕНИЕ] Длительность: ${audioInfo.duration}с, Размер: ${(audioInfo.fileSize / 1024).toFixed(1)}KB`,
      role: 'USER',
      fileName: audioInfo.isVoice ? 'voice_message.ogg' : 'audio_file',
      fileType: audioInfo.mimeType,
    };
    
    if (ctx.message?.message_id) {
      messageData.messageId = ctx.message.message_id;
    }
    
    await DatabaseService.createMessage(messageData);

    // Отправляем информативное сообщение пользователю
    const responseText = `🎵 <b>Аудиосообщение получено</b>

📊 <b>Информация о файле:</b>
⏱️ Длительность: ${audioInfo.duration} сек.
📦 Размер: ${(audioInfo.fileSize / 1024).toFixed(1)} KB
🎧 Тип: ${audioInfo.mimeType}
${audioInfo.isVoice ? '🎤 Голосовое сообщение' : '🎵 Аудиофайл'}

❌ <b>Обработка аудио недоступна</b>

К сожалению, я пока не могу обрабатывать аудиосообщения напрямую. Для получения ответа от AI-ассистента, пожалуйста, отправьте ваш вопрос текстом.

💡 <b>Что можно сделать:</b>
• Переведите аудио в текст с помощью голосового ввода на телефоне
• Используйте онлайн-сервисы для расшифровки аудио
• Напишите ваш вопрос текстом

Спасибо за понимание! 🙏`;

    await ctx.reply(responseText, { parse_mode: 'HTML' });

    logger.info('Audio message received (not processed)', {
      userId: ctx.user.id,
      telegramId: ctx.user.telegramId.toString(),
      duration: audioInfo.duration,
      fileSize: audioInfo.fileSize,
      mimeType: audioInfo.mimeType,
      isVoice: audioInfo.isVoice,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error in audioHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });
    
    await ctx.reply('❌ Произошла ошибка при обработке аудиосообщения. Попробуйте отправить текстовое сообщение.');
  }
};
