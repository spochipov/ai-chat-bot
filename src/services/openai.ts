import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { apiLogger } from '../utils/logger';

interface OpenAIMessage {
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

interface OpenAIResponse {
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

interface OpenAIModels {
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
}

class OpenAIService {
  private static instance: OpenAIService;
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;

  private constructor() {
    this.apiKey = process.env['OPENAI_API_KEY'] || '';
    this.baseURL =
      process.env['OPENAI_BASE_URL'] || 'https://api.openai.com/v1';
    this.defaultModel = process.env['OPENAI_MODEL'] || 'gpt-4';

    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 секунд
    });

    // Настройка интерцепторов для логирования
    this.client.interceptors.request.use(
      config => {
        apiLogger.debug('OpenAI request', {
          method: config.method,
          url: config.url,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: config.data,
        });
        return config;
      },
      (error: unknown) => {
        apiLogger.error('OpenAI request error', error);
        return Promise.reject(
          new Error(error instanceof Error ? error.message : 'Request error')
        );
      }
    );

    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        apiLogger.debug('OpenAI response', {
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
        apiLogger.error('OpenAI response error', errorInfo);
        return Promise.reject(new Error(errorInfo.message));
      }
    );
  }

  public static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  // Основной метод для отправки сообщений
  public static async sendMessage(
    messages: OpenAIMessage[],
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
    const instance = OpenAIService.getInstance();

    const requestData: {
      model: string;
      messages: OpenAIMessage[];
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
      const response = await instance.client.post<OpenAIResponse>(
        '/chat/completions',
        requestData
      );

      const choice = response.data.choices[0];
      if (!choice || !choice.message) {
        throw new Error('Invalid response from OpenAI API');
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
      apiLogger.error('Failed to send message to OpenAI', error);

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as {
          response?: {
            status?: number;
            data?: { error?: { message?: string; type?: string } };
          };
        };

        if (axiosError.response?.status === 401) {
          throw new Error('Invalid OpenAI API key');
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
          throw new Error('OpenAI service is temporarily unavailable');
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }
  }

  // Метод для получения списка доступных моделей
  public static async getModels(): Promise<
    Array<{
      id: string;
      object: string;
      created: number;
      ownedBy: string;
    }>
  > {
    const instance = OpenAIService.getInstance();

    try {
      const response = await instance.client.get<OpenAIModels>('/models');

      return response.data.data.map(model => ({
        id: model.id,
        object: model.object,
        created: model.created,
        ownedBy: model.owned_by,
      }));
    } catch (error: unknown) {
      apiLogger.error('Failed to get models from OpenAI', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get models: ${errorMessage}`);
    }
  }

  // Метод для анализа изображений (если модель поддерживает)
  public static async analyzeImage(
    imageUrl: string,
    prompt: string = 'Describe this image in detail',
    model: string = 'gpt-4o'
  ): Promise<{
    content: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    model: string;
  }> {
    const messages: OpenAIMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ];

    return OpenAIService.sendMessage(messages, { model });
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
    const messages: OpenAIMessage[] = [
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

    return OpenAIService.sendMessage(messages, options);
  }

  // Утилитарные методы
  public static getDefaultModel(): string {
    const instance = OpenAIService.getInstance();
    return instance.defaultModel;
  }

  public static setDefaultModel(model: string): void {
    const instance = OpenAIService.getInstance();
    instance.defaultModel = model;
  }

  // Метод для подсчета примерной стоимости
  public static calculateCost(
    promptTokens: number,
    completionTokens: number,
    model: string = 'gpt-4'
  ): number {
    // Официальные цены OpenAI (в долларах за 1000 токенов)
    const pricing: { [key: string]: { prompt: number; completion: number } } = {
      'gpt-4': { prompt: 0.03, completion: 0.06 },
      'gpt-4o': { prompt: 0.005, completion: 0.015 },
      'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
      'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
      'gpt-3.5-turbo': { prompt: 0.001, completion: 0.002 },
      'gpt-3.5-turbo-16k': { prompt: 0.003, completion: 0.004 },
    };

    const modelPricing = pricing[model] || pricing['gpt-4'];

    if (!modelPricing) {
      return 0;
    }

    const promptCost = (promptTokens / 1000) * modelPricing.prompt;
    const completionCost = (completionTokens / 1000) * modelPricing.completion;

    return promptCost + completionCost;
  }

  // Метод для проверки доступности сервиса
  public static async healthCheck(): Promise<boolean> {
    const instance = OpenAIService.getInstance();

    try {
      await instance.client.get('/models', { timeout: 5000 });
      return true;
    } catch (error) {
      apiLogger.error('OpenAI health check failed', error);
      return false;
    }
  }
}

export { OpenAIService, OpenAIMessage };
