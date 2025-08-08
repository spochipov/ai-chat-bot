import { BotContext } from '../middleware/auth';

export const analyticsHandler = async (ctx: BotContext) => {
  await ctx.reply('analytics handler - TODO: implement');
};
