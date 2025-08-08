import { BotContext } from './auth';

export const rateLimitMiddleware = async (_ctx: BotContext, next: () => Promise<void>) => {
  // TODO: Implement rate limiting logic
  return next();
};
