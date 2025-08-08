import { BotContext } from '../middleware/auth';

export const messageHandler = async (ctx: BotContext) => {
  await ctx.reply('message handler - TODO: implement');
};
