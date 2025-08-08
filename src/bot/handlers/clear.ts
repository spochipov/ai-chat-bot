import { BotContext } from '../middleware/auth';

export const clearHandler = async (ctx: BotContext) => {
  await ctx.reply('История очищена.');
};
