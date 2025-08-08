import { BotContext } from './auth';

export const errorHandler = async (_ctx: BotContext, next: () => Promise<void>) => {
  try {
    await next();
  } catch (error) {
    console.error('Bot error:', error);
    // TODO: Implement proper error handling
  }
};
