import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { apiLogger } from '../utils/logger';

interface OpenRouterMessage {
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

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterBalance {
  data: {
    credits: number;
    usage: number;
  };
}

interface OpenRouterModels {
  data: Array<{
    id: string;
    name: string;
    description: string;
    pricing: {
      prompt: string;
      completion: string;
    };
    context_length: number;
    architecture: {
      modality: string;
      tokenizer: string;
      instruct_type: string;
    };
    top_provider: {
      context_length: number;
      max_completion_tokens: number;
    };
  }>;
}

class OpenRouterService {
  private static instance: OpenRouterService;
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;

  private constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.baseURL =
      process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.defaultModel = process.env.OPENROUTER_MODEL || 'openai/gpt-4';

    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is required');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/spochipov/ai-chat-bot',
        'X-Title': 'AI Chat Bot',
      },
      timeout: 60000, // 60 секунд
    });

    // Настройка интерцепторов для логирования
    this.client.interceptors.request.use(
      config => {
        apiLogger.debug('OpenRouter request', {
          method: config.method,
          url: config.url,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: config.data,
        });
        return config;
      },
      (error: unknown) => {
        apiLogger.error('OpenRouter request error', error);
        return Promise.reject(
          new Error(error instanceof Error ? error.message : 'Request error')
        );
      }
    );

    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        apiLogger.debug('OpenRouter response', {
          status: response.status,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: response.data,
        });
        return response;
      },
      (error: unknown) => {
        const errorInfo = {
          status:
            error && typeof error === 'object' && 'response' in error
              ? (error as { response?: { status?: number } }).response?.status
              : undefined,
          data:
            error && typeof error === 'object' && 'response' in error
              ? (error as { response?: { data?: unknown } }).response?.data
              : undefined,
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        apiLogger.error('OpenRouter response error', errorInfo);
        return Promise.reject(new Error(errorInfo.message));
      }
    );
  }

  public static getInstance(): OpenRouterService {
    if (!OpenRouterService.instance) {
      OpenRouterService.instance = new OpenRouterService();
    }
    return OpenRouterService.instance;
  }

  // Основной метод для отправки сообщений
  public static async sendMessage(
    messages: OpenRouterMessage[],
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    } = {}
  ): Promise<{
    content: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    model: string;
  }> {
    const instance = OpenRouterService.getInstance();

    const requestData: {
      model: string;
      messages: OpenRouterMessage[];
      max_tokens: number;
      temperature: number;
      stream: boolean;
      top_p?: number;
      frequency_penalty?: number;
      presence_penalty?: number;
    } = {
      model: options.model || instance.defaultModel,
      messages,
      max_tokens:
        options.maxTokens || parseInt(process.env.DEFAULT_MAX_TOKENS || '4000'),
      temperature:
        options.temperature ||
        parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'),
      stream: false,
    };

    if (options.topP !== undefined) {
      requestData.top_p = options.topP;
    }
    if (options.frequencyPenalty !== undefined) {
      requestData.frequency_penalty = options.frequencyPenalty;
    }
    if (options.presencePenalty !== undefined) {
      requestData.presence_penalty = options.presencePenalty;
    }

    try {
      const response = await instance.client.post<OpenRouterResponse>(
        '/chat/completions',
        requestData
      );

      const choice = response.data.choices[0];
      if (!choice || !choice.message) {
        throw new Error('Invalid response from OpenRouter API');
      }

      return {
        content: choice.message.content,
        usage: {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens,
        },
        model: response.data.model,
      };
    } catch (error: unknown) {
      apiLogger.error('Failed to send message to OpenRouter', error);

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as {
          response?: {
            status?: number;
            data?: { error?: { message?: string } };
          };
        };

        if (axiosError.response?.status === 401) {
          throw new Error('Invalid OpenRouter API key');
        } else if (axiosError.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (axiosError.response?.status === 400) {
          throw new Error(
            `Bad request: ${axiosError.response.data?.error?.message || 'Invalid request'}`
          );
        } else if (
          axiosError.response?.status &&
          axiosError.response.status >= 500
        ) {
          throw new Error('OpenRouter service is temporarily unavailable');
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`OpenRouter API error: ${errorMessage}`);
    }
  }

  // Метод для получения баланса
  public static async getBalance(): Promise<{
    credits: number;
    usage: number;
  }> {
    const instance = OpenRouterService.getInstance();

    try {
      const response =
        await instance.client.get<OpenRouterBalance>('/auth/key');

      return {
        credits: response.data.data.credits,
        usage: response.data.data.usage,
      };
    } catch (error: unknown) {
      apiLogger.error('Failed to get balance from OpenRouter', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get balance: ${errorMessage}`);
    }
  }

  // Метод для получения списка доступных моделей
  public static async getModels(): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      pricing: {
        prompt: string;
        completion: string;
      };
      contextLength: number;
      modality: string;
    }>
  > {
    const instance = OpenRouterService.getInstance();

    try {
      const response = await instance.client.get<OpenRouterModels>('/models');

      return response.data.data.map(model => ({
        id: model.id,
        name: model.name,
        description: model.description,
        pricing: model.pricing,
        contextLength: model.context_length,
        modality: model.architecture.modality,
      }));
    } catch (error: unknown) {
      apiLogger.error('Failed to get models from OpenRouter', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get models: ${errorMessage}`);
    }
  }

  // Метод для анализа изображений (если модель поддерживает)
  public static async analyzeImage(
    imageUrl: string,
    prompt: string = 'Describe this image in detail',
    model: string = 'openai/gpt-4o'
  ): Promise<{
    content: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    model: string;
  }> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'user',
        content: `${prompt}\n\nImage: ${imageUrl}`,
      },
    ];

    return OpenRouterService.sendMessage(messages, { model });
  }

  // Метод для обработки текстовых файлов
  public static async processTextFile(
    content: string,
    prompt: string = 'Analyze this document and provide a summary',
    model?: string
  ): Promise<{
    content: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    model: string;
  }> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'user',
        content: `${prompt}\n\nDocument content:\n${content}`,
      },
    ];

    const options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    } = {};
    if (model) {
      options.model = model;
    }

    return OpenRouterService.sendMessage(messages, options);
  }

  // Утилитарные методы
  public static getDefaultModel(): string {
    const instance = OpenRouterService.getInstance();
    return instance.defaultModel;
  }

  public static setDefaultModel(model: string): void {
    const instance = OpenRouterService.getInstance();
    instance.defaultModel = model;
  }

  // Метод для подсчета примерной стоимости
  public static calculateCost(
    promptTokens: number,
    completionTokens: number,
    model: string = 'openai/gpt-4'
  ): number {
    // Примерные цены для GPT-4 (в долларах за 1000 токенов)
    const pricing: { [key: string]: { prompt: number; completion: number } } = {
      'openai/gpt-4': { prompt: 0.03, completion: 0.06 },
      'openai/gpt-4o': { prompt: 0.005, completion: 0.015 },
      'openai/gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
      'openai/gpt-3.5-turbo': { prompt: 0.001, completion: 0.002 },
    };

    const modelPricing = pricing[model] || pricing['openai/gpt-4'];

    if (!modelPricing) {
      return 0;
    }

    const promptCost = (promptTokens / 1000) * modelPricing.prompt;
    const completionCost = (completionTokens / 1000) * modelPricing.completion;

    return promptCost + completionCost;
  }

  // Метод для проверки доступности сервиса
  public static async healthCheck(): Promise<boolean> {
    const instance = OpenRouterService.getInstance();

    try {
      await instance.client.get('/models', { timeout: 5000 });
      return true;
    } catch (error) {
      apiLogger.error('OpenRouter health check failed', error);
      return false;
    }
  }
}

export { OpenRouterService, OpenRouterMessage };
