declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      BOT_TOKEN: string;
      OPENROUTER_API_KEY: string;
      OPENROUTER_BASE_URL?: string;
      OPENROUTER_MODEL?: string;
      DEFAULT_MAX_TOKENS?: string;
      DEFAULT_TEMPERATURE?: string;
      REDIS_URL?: string;
      REDIS_PASSWORD?: string;
      DATABASE_URL: string;
      LOG_LEVEL?: string;
      ADMIN_TELEGRAM_ID?: string;
    }
  }
}

export {};
