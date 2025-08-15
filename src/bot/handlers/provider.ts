import { BotContext } from '../middleware/auth';
import { logger } from '../../utils/logger';
import { AIService, AIProvider } from '../../services/ai';

export const providerHandler = async (ctx: BotContext) => {
  try {
    // Проверяем, является ли пользователь администратором
    if (!ctx.user || ctx.user.telegramId.toString() !== process.env['ADMIN_TELEGRAM_ID']) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    const args = ctx.message && 'text' in ctx.message 
      ? ctx.message.text.split(' ').slice(1) 
      : [];

    if (args.length === 0) {
      // Показываем текущий статус провайдеров
      await showProviderStatus(ctx);
      return;
    }

    const command = args[0]?.toLowerCase();

    switch (command) {
      case 'set':
        if (args.length < 2) {
          await ctx.reply('❌ Укажите провайдера: /provider set openrouter|openai');
          return;
        }
        await setProvider(ctx, args[1] as AIProvider);
        break;

      case 'status':
        await showProviderStatus(ctx);
        break;

      case 'health':
        await checkProvidersHealth(ctx);
        break;

      case 'models':
        if (args.length < 2) {
          await ctx.reply('❌ Укажите провайдера: /provider models openrouter|openai');
          return;
        }
        await showProviderModels(ctx, args[1] as AIProvider);
        break;

      default:
        await ctx.reply(
          '❓ Доступные команды:\n\n' +
          '• `/provider` - показать статус провайдеров\n' +
          '• `/provider set <provider>` - установить провайдера (openrouter|openai)\n' +
          '• `/provider status` - показать текущий статус\n' +
          '• `/provider health` - проверить здоровье провайдеров\n' +
          '• `/provider models <provider>` - показать модели провайдера'
        );
        break;
    }

  } catch (error) {
    logger.error('Error in providerHandler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: ctx.user?.id,
      telegramId: ctx.from?.id
    });
    
    await ctx.reply('❌ Произошла ошибка при выполнении команды.');
  }
};

async function showProviderStatus(ctx: BotContext): Promise<void> {
  try {
    const currentProvider = AIService.getDefaultProvider();
    const healthStatus = await AIService.healthCheckAll();

    const statusMessage = 
      '🤖 **Статус AI провайдеров**\n\n' +
      `📍 **Текущий провайдер:** ${currentProvider}\n\n` +
      '🔍 **Доступность:**\n' +
      `• OpenRouter: ${healthStatus.openrouter ? '✅ Доступен' : '❌ Недоступен'}\n` +
      `• OpenAI: ${healthStatus.openai ? '✅ Доступен' : '❌ Недоступен'}\n\n` +
      '⚙️ **Модели по умолчанию:**\n' +
      `• OpenRouter: ${AIService.getDefaultModel('openrouter')}\n` +
      `• OpenAI: ${AIService.getDefaultModel('openai')}`;

    await ctx.reply(statusMessage, { parse_mode: 'Markdown' });

  } catch (error) {
    logger.error('Error showing provider status', error);
    await ctx.reply('❌ Ошибка при получении статуса провайдеров.');
  }
}

async function setProvider(ctx: BotContext, provider: AIProvider): Promise<void> {
  try {
    if (provider !== 'openrouter' && provider !== 'openai') {
      await ctx.reply('❌ Неверный провайдер. Доступны: openrouter, openai');
      return;
    }

    // Проверяем доступность провайдера
    const isAvailable = await AIService.isProviderAvailable(provider);
    if (!isAvailable) {
      await ctx.reply(`❌ Провайдер ${provider} недоступен. Проверьте конфигурацию API ключей.`);
      return;
    }

    // Устанавливаем провайдера
    AIService.setDefaultProvider(provider);

    await ctx.reply(
      `✅ Провайдер успешно изменен на **${provider}**\n\n` +
      `🔧 Модель по умолчанию: ${AIService.getDefaultModel(provider)}`,
      { parse_mode: 'Markdown' }
    );

    logger.info('AI provider changed', {
      newProvider: provider,
      changedBy: ctx.user?.telegramId.toString(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error setting provider', error);
    await ctx.reply('❌ Ошибка при установке провайдера.');
  }
}

async function checkProvidersHealth(ctx: BotContext): Promise<void> {
  try {
    await ctx.reply('🔍 Проверяю доступность провайдеров...');

    const healthStatus = await AIService.healthCheckAll();

    const healthMessage = 
      '🏥 **Проверка здоровья провайдеров**\n\n' +
      `🔸 **OpenRouter:** ${healthStatus.openrouter ? '✅ Работает' : '❌ Недоступен'}\n` +
      `🔸 **OpenAI:** ${healthStatus.openai ? '✅ Работает' : '❌ Недоступен'}\n\n` +
      `⏰ Проверено: ${new Date().toLocaleString('ru-RU')}`;

    await ctx.reply(healthMessage, { parse_mode: 'Markdown' });

  } catch (error) {
    logger.error('Error checking providers health', error);
    await ctx.reply('❌ Ошибка при проверке здоровья провайдеров.');
  }
}

async function showProviderModels(ctx: BotContext, provider: AIProvider): Promise<void> {
  try {
    if (provider !== 'openrouter' && provider !== 'openai') {
      await ctx.reply('❌ Неверный провайдер. Доступны: openrouter, openai');
      return;
    }

    await ctx.reply(`🔍 Получаю список моделей для ${provider}...`);

    const models = await AIService.getModels(provider);
    
    if (models.length === 0) {
      await ctx.reply(`❌ Не удалось получить модели для ${provider}`);
      return;
    }

    // Ограничиваем количество моделей для отображения
    const displayModels = models.slice(0, 20);
    const hasMore = models.length > 20;

    let modelsMessage = `🤖 **Модели ${provider}** (показано ${displayModels.length} из ${models.length}):\n\n`;
    
    displayModels.forEach((model, index) => {
      const isDefault = model.id === AIService.getDefaultModel(provider);
      const defaultMark = isDefault ? ' ⭐' : '';
      modelsMessage += `${index + 1}. \`${model.id}\`${defaultMark}\n`;
      
      if (model.description && model.description !== model.name) {
        modelsMessage += `   _${model.description.substring(0, 80)}${model.description.length > 80 ? '...' : ''}_\n`;
      }
      modelsMessage += '\n';
    });

    if (hasMore) {
      modelsMessage += `\n📝 И еще ${models.length - 20} моделей...`;
    }

    modelsMessage += '\n⭐ - модель по умолчанию';

    await ctx.reply(modelsMessage, { parse_mode: 'Markdown' });

  } catch (error) {
    logger.error('Error showing provider models', error);
    await ctx.reply(`❌ Ошибка при получении моделей для ${provider}.`);
  }
}
