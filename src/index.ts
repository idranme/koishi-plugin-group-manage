import { Context, Schema } from 'koishi'

export const name = 'group-manage'

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

export const usage: string = `
使用本插件的指令，需要用户的权限等级为 3 及以上。

权限设置教程: [https://koishi.chat/zh-CN/manual/usage/customize.html#%E7%94%A8%E6%88%B7%E6%9D%83%E9%99%90](https://koishi.chat/zh-CN/manual/usage/customize.html#%E7%94%A8%E6%88%B7%E6%9D%83%E9%99%90)
`

export function apply(ctx: Context) {
  const command = ctx.command('group-manage', '群组管理')

  command.subcommand('ban <user:user> <duration:number> <type>', '禁言指定用户', { authority: 3 })
    .usage('示例：ban @user 1 分钟')
    .alias('禁言')
    .action(async ({ session }, user, duration, type) => {
      if (!user) return '请指定被禁言的用户'
      if (!duration) return '请指定禁言时长'
      const [platform, userId] = user.split(':')
      switch (type) {
        case '秒':
        case '秒钟':
        case 's':
          duration = duration * 1000
          break;
        case '分':
        case '分钟':
        case 'min':
          duration = duration * 60 * 1000
          break;
        case '时':
        case '小时':
        case 'h':
          duration = duration * 60 * 60 * 1000
          break;
        case '天':
        case 'd':
          duration = duration * 24 * 60 * 60 * 1000
          break;
        default: return '请指定禁言时长的单位为秒/分钟/小时/天'
      }
      await session.bot.muteGuildMember(session.guildId, userId, duration)
      return '已执行禁言'
    })

  command.subcommand('unban <user:user>', '取消指定用户的禁言', { authority: 3 })
    .usage('示例：unban @user')
    .alias('取消禁言')
    .action(async ({ session }, user) => {
      if (!user) return '请指定被取消禁言的用户'
      const [platform, userId] = user.split(':')
      await session.bot.muteGuildMember(session.guildId, userId, 0)
      return '已执行取消禁言'
    })

  command.subcommand('delmsg', '撤回指定消息', { authority: 3 })
    .usage('示例：回复一条消息，内容有且仅有“delmsg”')
    .alias('撤回')
    .action(async ({ session }) => {
      if (!session.quote) return '请回复要撤回的消息'
      const msgId = session.quote.id || session.quote.messageId
      await session.bot.deleteMessage(session.channelId, msgId)
      return '已执行撤回'
    })
}
