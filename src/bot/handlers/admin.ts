import { BotContext } from '../middleware/auth';

export const adminHandler = async (ctx: BotContext) => {
  await ctx.reply('admin handler - TODO: implement');
};
