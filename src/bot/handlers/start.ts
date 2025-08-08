import { BotContext } from '../middleware/auth';

export const startHandler = async (ctx: BotContext) => {
  await ctx.reply('Добро пожаловать! Это AI чат-бот.');
};
