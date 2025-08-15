import { OpenRouterService, OpenRouterMessage } from './openrouter';
import { OpenAIService, OpenAIMessage } from './openai';
import { apiLogger } from '../utils/logger';

// Универсальный тип сообщения
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content:
    | string
    | Array<{
        type: 'text' | 'image_url';
        text?: string;
        image_url?: {
          url: string;
        };
      }>;
}

// Универсальный тип ответа
export interface AIResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: 'openrouter' | 'openai';
}

// Тип провайдера AI
export type AIProvider = 'openrouter' | 'openai';

// Опции для запроса
export interface AIRequestOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  provider?: AIProvider;
}

class AIService {
  private static defaultProvider: AIProvider = 'openrouter';

  // Получить провайдера по умолчанию
  public static getDefaultProvider(): AIProvider {
    const envProvider = process.env['AI_PROVIDER'] as AIProvider;
    if (envProvider && (envProvider === 'openrouter' || envProvider === 'openai')) {
      return envProvider;
    }
    return AIService.defaultProvider;
  }

  // Установить провайдера по умолчанию
  public static setDefaultProvider(provider: AIProvider): void {
    AIService.defaultProvider = provider;
  }

  // Проверить доступность провайдера
  public static async isProviderAvailable(provider: AIProvider): Promise<boolean> {
    try {
      switch (provider) {
        case 'openrouter':
          return await OpenRouterService.healthCheck();
        case 'openai':
          return await OpenAIService.healthCheck();
        default:
          return false;
      }
    } catch (error) {
      apiLogger.error(`Provider ${provider} is not available`, error);
      return false;
    }
  }

  // Получить доступного провайдера
  public static async getAvailableProvider(preferredProvider?: AIProvider): Promise<AIProvider> {
    const providers: AIProvider[] = preferredProvider 
      ? [preferredProvider, ...(['openrouter', 'openai'].filter(p => p !== preferredProvider) as AIProvider[])]
      : [AIService.getDefaultProvider(), ...(['openrouter', 'openai'].filter(p => p !== AIService.getDefaultProvider()) as AIProvider[])];

    for (const provider of providers) {
      if (await AIService.isProviderAvailable(provider)) {
        return provider;
      }
    }

    throw new Error('No AI providers are available');
  }

  // Основной метод для отправки сообщений
  public static async sendMessage(
    messages: AIMessage[],
    options: AIRequestOptions = {}
  ): Promise<AIResponse> {
    const provider = options.provider || await AIService.getAvailableProvider();
    
    apiLogger.info('Sending message to AI provider', {
      provider,
      messageCount: messages.length,
      model: options.model,
    });

    try {
      switch (provider) {
        case 'openrouter': {
          const openRouterMessages: OpenRouterMessage[] = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          }));

          const openRouterOptions: {
            model?: string;
            maxTokens?: number;
            temperature?: number;
            topP?: number;
            frequencyPenalty?: number;
            presencePenalty?: number;
          } = {};
          
          if (options.model !== undefined) openRouterOptions.model = options.model;
          if (options.maxTokens !== undefined) openRouterOptions.maxTokens = options.maxTokens;
          if (options.temperature !== undefined) openRouterOptions.temperature = options.temperature;
          if (options.topP !== undefined) openRouterOptions.topP = options.topP;
          if (options.frequencyPenalty !== undefined) openRouterOptions.frequencyPenalty = options.frequencyPenalty;
          if (options.presencePenalty !== undefined) openRouterOptions.presencePenalty = options.presencePenalty;

          const response = await OpenRouterService.sendMessage(openRouterMessages, openRouterOptions);

          return {
            ...response,
            provider: 'openrouter',
          };
        }

        case 'openai': {
          const openAIMessages: OpenAIMessage[] = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          }));

          const openAIOptions: {
            model?: string;
            maxTokens?: number;
            temperature?: number;
            topP?: number;
            frequencyPenalty?: number;
            presencePenalty?: number;
          } = {};
          
          if (options.model !== undefined) openAIOptions.model = options.model;
          if (options.maxTokens !== undefined) openAIOptions.maxTokens = options.maxTokens;
          if (options.temperature !== undefined) openAIOptions.temperature = options.temperature;
          if (options.topP !== undefined) openAIOptions.topP = options.topP;
          if (options.frequencyPenalty !== undefined) openAIOptions.frequencyPenalty = options.frequencyPenalty;
          if (options.presencePenalty !== undefined) openAIOptions.presencePenalty = options.presencePenalty;

          const response = await OpenAIService.sendMessage(openAIMessages, openAIOptions);

          return {
            ...response,
            provider: 'openai',
          };
        }

        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }
    } catch (error) {
      apiLogger.error(`Failed to send message via ${provider}`, error);
      
      // Попытка использовать альтернативного провайдера
      if (!options.provider) {
        const alternativeProvider = provider === 'openrouter' ? 'openai' : 'openrouter';
        
        if (await AIService.isProviderAvailable(alternativeProvider)) {
          apiLogger.info(`Trying alternative provider: ${alternativeProvider}`);
          return AIService.sendMessage(messages, { ...options, provider: alternativeProvider });
        }
      }

      throw error;
    }
  }

  // Анализ изображений
  public static async analyzeImage(
    imageUrl: string,
    prompt: string = 'Describe this image in detail',
    options: AIRequestOptions = {}
  ): Promise<AIResponse> {
    const provider = options.provider || await AIService.getAvailableProvider();
    
    // Для анализа изображений предпочитаем модели с поддержкой vision
    const defaultModel = provider === 'openai' ? 'gpt-4o' : 'openai/gpt-4o';
    const model = options.model || defaultModel;

    try {
      switch (provider) {
        case 'openrouter': {
          const response = await OpenRouterService.analyzeImage(imageUrl, prompt, model);
          return {
            ...response,
            provider: 'openrouter',
          };
        }

        case 'openai': {
          const response = await OpenAIService.analyzeImage(imageUrl, prompt, model);
          return {
            ...response,
            provider: 'openai',
          };
        }

        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }
    } catch (error) {
      apiLogger.error(`Failed to analyze image via ${provider}`, error);
      
      // Попытка использовать альтернативного провайдера
      if (!options.provider) {
        const alternativeProvider = provider === 'openrouter' ? 'openai' : 'openrouter';
        
        if (await AIService.isProviderAvailable(alternativeProvider)) {
          apiLogger.info(`Trying alternative provider for image analysis: ${alternativeProvider}`);
          return AIService.analyzeImage(imageUrl, prompt, { ...options, provider: alternativeProvider });
        }
      }

      throw error;
    }
  }

  // Обработка текстовых файлов
  public static async processTextFile(
    content: string,
    prompt: string = 'Analyze this document and provide a summary',
    options: AIRequestOptions = {}
  ): Promise<AIResponse> {
    const provider = options.provider || await AIService.getAvailableProvider();

    try {
      switch (provider) {
        case 'openrouter': {
          const response = await OpenRouterService.processTextFile(content, prompt, options.model);
          return {
            ...response,
            provider: 'openrouter',
          };
        }

        case 'openai': {
          const response = await OpenAIService.processTextFile(content, prompt, options.model);
          return {
            ...response,
            provider: 'openai',
          };
        }

        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }
    } catch (error) {
      apiLogger.error(`Failed to process text file via ${provider}`, error);
      
      // Попытка использовать альтернативного провайдера
      if (!options.provider) {
        const alternativeProvider = provider === 'openrouter' ? 'openai' : 'openrouter';
        
        if (await AIService.isProviderAvailable(alternativeProvider)) {
          apiLogger.info(`Trying alternative provider for text processing: ${alternativeProvider}`);
          return AIService.processTextFile(content, prompt, { ...options, provider: alternativeProvider });
        }
      }

      throw error;
    }
  }

  // Получить список доступных моделей
  public static async getModels(provider?: AIProvider): Promise<Array<{
    id: string;
    name?: string;
    description?: string;
    provider: AIProvider;
  }>> {
    const targetProvider = provider || await AIService.getAvailableProvider();

    try {
      switch (targetProvider) {
        case 'openrouter': {
          const models = await OpenRouterService.getModels();
          return models.map(model => ({
            id: model.id,
            name: model.name,
            description: model.description,
            provider: 'openrouter' as const,
          }));
        }

        case 'openai': {
          const models = await OpenAIService.getModels();
          return models.map(model => ({
            id: model.id,
            name: model.id,
            description: `OpenAI model: ${model.id}`,
            provider: 'openai' as const,
          }));
        }

        default:
          throw new Error(`Unsupported AI provider: ${targetProvider}`);
      }
    } catch (error) {
      apiLogger.error(`Failed to get models from ${targetProvider}`, error);
      throw error;
    }
  }

  // Подсчет стоимости
  public static calculateCost(
    promptTokens: number,
    completionTokens: number,
    model: string,
    provider: AIProvider
  ): number {
    switch (provider) {
      case 'openrouter':
        return OpenRouterService.calculateCost(promptTokens, completionTokens, model);
      case 'openai':
        return OpenAIService.calculateCost(promptTokens, completionTokens, model);
      default:
        return 0;
    }
  }

  // Получить модель по умолчанию для провайдера
  public static getDefaultModel(provider?: AIProvider): string {
    const targetProvider = provider || AIService.getDefaultProvider();
    
    switch (targetProvider) {
      case 'openrouter':
        return OpenRouterService.getDefaultModel();
      case 'openai':
        return OpenAIService.getDefaultModel();
      default:
        return 'gpt-4';
    }
  }

  // Установить модель по умолчанию для провайдера
  public static setDefaultModel(model: string, provider?: AIProvider): void {
    const targetProvider = provider || AIService.getDefaultProvider();
    
    switch (targetProvider) {
      case 'openrouter':
        OpenRouterService.setDefaultModel(model);
        break;
      case 'openai':
        OpenAIService.setDefaultModel(model);
        break;
    }
  }

  // Проверка здоровья всех провайдеров
  public static async healthCheckAll(): Promise<{
    openrouter: boolean;
    openai: boolean;
  }> {
    const [openrouterHealth, openaiHealth] = await Promise.allSettled([
      OpenRouterService.healthCheck(),
      OpenAIService.healthCheck(),
    ]);

    return {
      openrouter: openrouterHealth.status === 'fulfilled' ? openrouterHealth.value : false,
      openai: openaiHealth.status === 'fulfilled' ? openaiHealth.value : false,
    };
  }
}

export { AIService };
