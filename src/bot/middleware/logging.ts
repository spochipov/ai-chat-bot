import { BotContext } from './auth';

export const loggingMiddleware = async (_ctx: BotContext, next: () => Promise<void>) => {
  // TODO: Implement logging logic
  return next();
};
