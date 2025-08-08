import { BotContext } from '../middleware/auth';

export const fileHandler = async (ctx: BotContext) => {
  await ctx.reply('file handler - TODO: implement');
};
