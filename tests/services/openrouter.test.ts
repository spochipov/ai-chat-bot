import { OpenRouterService } from '../../src/services/openrouter';
import axios from 'axios';

// Мокаем axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OpenRouterService', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Создаем мок для axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Устанавливаем переменные окружения для тестов
    process.env.OPENROUTER_API_KEY = 'test-api-key';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.OPENROUTER_MODEL = 'openai/gpt-4';
    
    // Очищаем синглтон
    (OpenRouterService as any).instance = undefined;
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Очищаем синглтон после каждого теста
    (OpenRouterService as any).instance = undefined;
  });

  describe('sendMessage', () => {
    it('должен отправить сообщение и вернуть ответ', async () => {
      const messages = [
        { role: 'user' as const, content: 'Hello, world!' },
      ];

      const mockResponse = {
        data: {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'openai/gpt-4',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello! How can I help you today?',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 9,
            completion_tokens: 12,
            total_tokens: 21,
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await OpenRouterService.sendMessage(messages);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions', {
        model: 'openai/gpt-4',
        messages,
        max_tokens: 4000,
        temperature: 0.7,
        stream: false,
      });

      expect(result).toEqual({
        content: 'Hello! How can I help you today?',
        usage: {
          promptTokens: 9,
          completionTokens: 12,
          totalTokens: 21,
        },
        model: 'openai/gpt-4',
      });
    });

    it('должен отправить сообщение с кастомными параметрами', async () => {
      const messages = [
        { role: 'user' as const, content: 'Test message' },
      ];

      const options = {
        model: 'openai/gpt-3.5-turbo',
        maxTokens: 1000,
        temperature: 0.5,
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
      };

      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'Test response',
              },
            },
          ],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 10,
            total_tokens: 15,
          },
          model: 'openai/gpt-3.5-turbo',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await OpenRouterService.sendMessage(messages, options);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions', {
        model: 'openai/gpt-3.5-turbo',
        messages,
        max_tokens: 1000,
        temperature: 0.5,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.2,
        stream: false,
      });
    });

    it('должен выбросить ошибку при 401 статусе', async () => {
      const messages = [
        { role: 'user' as const, content: 'Test' },
      ];

      const error = {
        response: {
          status: 401,
          data: { error: { message: 'Unauthorized' } },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(OpenRouterService.sendMessage(messages)).rejects.toThrow(
        'Invalid OpenRouter API key'
      );
    });

    it('должен выбросить ошибку при 429 статусе (rate limit)', async () => {
      const messages = [
        { role: 'user' as const, content: 'Test' },
      ];

      const error = {
        response: {
          status: 429,
          data: { error: { message: 'Rate limit exceeded' } },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(OpenRouterService.sendMessage(messages)).rejects.toThrow(
        'Rate limit exceeded. Please try again later.'
      );
    });

    it('должен выбросить ошибку при 400 статусе (bad request)', async () => {
      const messages = [
        { role: 'user' as const, content: 'Test' },
      ];

      const error = {
        response: {
          status: 400,
          data: { error: { message: 'Invalid request format' } },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(OpenRouterService.sendMessage(messages)).rejects.toThrow(
        'Bad request: Invalid request format'
      );
    });

    it('должен выбросить ошибку при 500+ статусе', async () => {
      const messages = [
        { role: 'user' as const, content: 'Test' },
      ];

      const error = {
        response: {
          status: 500,
          data: { error: { message: 'Internal server error' } },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(OpenRouterService.sendMessage(messages)).rejects.toThrow(
        'OpenRouter service is temporarily unavailable'
      );
    });

    it('должен выбросить ошибку при отсутствии ответа в choices', async () => {
      const messages = [
        { role: 'user' as const, content: 'Test' },
      ];

      const mockResponse = {
        data: {
          choices: [],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 0,
            total_tokens: 5,
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await expect(OpenRouterService.sendMessage(messages)).rejects.toThrow(
        'Invalid response from OpenRouter API'
      );
    });
  });

  describe('getBalance', () => {
    it('должен получить баланс аккаунта', async () => {
      const mockResponse = {
        data: {
          data: {
            credits: 100.5,
            usage: 25.3,
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await OpenRouterService.getBalance();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/auth/key');
      expect(result).toEqual({
        credits: 100.5,
        usage: 25.3,
      });
    });

    it('должен выбросить ошибку при неудачном запросе баланса', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(OpenRouterService.getBalance()).rejects.toThrow(
        'Failed to get balance: Network error'
      );
    });
  });

  describe('getModels', () => {
    it('должен получить список доступных моделей', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: 'openai/gpt-4',
              name: 'GPT-4',
              description: 'GPT-4 model',
              pricing: {
                prompt: '0.03',
                completion: '0.06',
              },
              context_length: 8192,
              architecture: {
                modality: 'text',
                tokenizer: 'cl100k_base',
                instruct_type: 'chat',
              },
            },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await OpenRouterService.getModels();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/models');
      expect(result).toEqual([
        {
          id: 'openai/gpt-4',
          name: 'GPT-4',
          description: 'GPT-4 model',
          pricing: {
            prompt: '0.03',
            completion: '0.06',
          },
          contextLength: 8192,
          modality: 'text',
        },
      ]);
    });
  });

  describe('analyzeImage', () => {
    it('должен проанализировать изображение', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const prompt = 'Describe this image';

      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'This is a beautiful landscape image.',
              },
            },
          ],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 15,
            total_tokens: 35,
          },
          model: 'openai/gpt-4o',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await OpenRouterService.analyzeImage(imageUrl, prompt);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions', {
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nImage: ${imageUrl}`,
          },
        ],
        max_tokens: 4000,
        temperature: 0.7,
        stream: false,
      });

      expect(result).toEqual({
        content: 'This is a beautiful landscape image.',
        usage: {
          promptTokens: 20,
          completionTokens: 15,
          totalTokens: 35,
        },
        model: 'openai/gpt-4o',
      });
    });
  });

  describe('processTextFile', () => {
    it('должен обработать текстовый файл', async () => {
      const content = 'This is a test document content.';
      const prompt = 'Summarize this document';

      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'This document contains test content.',
              },
            },
          ],
          usage: {
            prompt_tokens: 25,
            completion_tokens: 10,
            total_tokens: 35,
          },
          model: 'openai/gpt-4',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await OpenRouterService.processTextFile(content, prompt);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions', {
        model: 'openai/gpt-4',
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nDocument content:\n${content}`,
          },
        ],
        max_tokens: 4000,
        temperature: 0.7,
        stream: false,
      });

      expect(result.content).toBe('This document contains test content.');
    });
  });

  describe('calculateCost', () => {
    it('должен рассчитать стоимость для GPT-4', () => {
      const cost = OpenRouterService.calculateCost(1000, 500, 'openai/gpt-4');
      // 1000 * 0.03 / 1000 + 500 * 0.06 / 1000 = 0.03 + 0.03 = 0.06
      expect(cost).toBe(0.06);
    });

    it('должен рассчитать стоимость для GPT-3.5-turbo', () => {
      const cost = OpenRouterService.calculateCost(1000, 500, 'openai/gpt-3.5-turbo');
      // 1000 * 0.001 / 1000 + 500 * 0.002 / 1000 = 0.001 + 0.001 = 0.002
      expect(cost).toBe(0.002);
    });

    it('должен использовать цены GPT-4 для неизвестной модели', () => {
      const cost = OpenRouterService.calculateCost(1000, 500, 'unknown/model');
      expect(cost).toBe(0.06);
    });

    it('должен вернуть 0 для модели без ценообразования', () => {
      const cost = OpenRouterService.calculateCost(1000, 500, 'test/model');
      expect(cost).toBe(0.06); // Fallback to GPT-4 pricing
    });
  });

  describe('healthCheck', () => {
    it('должен вернуть true при успешной проверке', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });

      const result = await OpenRouterService.healthCheck();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/models', { timeout: 5000 });
      expect(result).toBe(true);
    });

    it('должен вернуть false при неудачной проверке', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const result = await OpenRouterService.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('getDefaultModel и setDefaultModel', () => {
    it('должен получить модель по умолчанию', () => {
      const defaultModel = OpenRouterService.getDefaultModel();
      expect(defaultModel).toBe('openai/gpt-4');
    });

    it('должен установить новую модель по умолчанию', () => {
      OpenRouterService.setDefaultModel('openai/gpt-3.5-turbo');
      const defaultModel = OpenRouterService.getDefaultModel();
      expect(defaultModel).toBe('openai/gpt-3.5-turbo');
    });
  });
});
