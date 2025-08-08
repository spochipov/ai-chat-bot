import { BotContext } from '../middleware/auth';

export const statusHandler = async (ctx: BotContext) => {
  await ctx.reply('Статус бота: активен.');
};
