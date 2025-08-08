import { Context } from 'telegraf';

export interface BotContext extends Context {
  user?: {
    id: string;
    telegramId: bigint;
    isAdmin: boolean;
    accessKeyId: string;
  };
  awaitingAccessKey?: boolean;
  awaitingKeyDeactivation?: boolean;
}

export const authMiddleware = async (_ctx: BotContext, next: () => Promise<void>) => {
  // TODO: Implement authentication logic
  return next();
};
