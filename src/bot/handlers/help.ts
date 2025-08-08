import { BotContext } from '../middleware/auth';

export const helpHandler = async (ctx: BotContext) => {
  await ctx.reply('Справка по командам бота.');
};
