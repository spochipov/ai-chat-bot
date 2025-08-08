import { BotContext } from '../middleware/auth';

export const listUsersHandler = async (ctx: BotContext) => {
  await ctx.reply('listUsers handler - TODO: implement');
};
