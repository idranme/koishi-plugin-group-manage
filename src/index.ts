import { Context, Schema, Dict, Time } from 'koishi'

export const name = 'group-manage'

interface BlockingRule {
  enable: boolean
  blockingWords: string[]
  mute: boolean
  muteDuration: number
  recall: boolean
}

export interface Config {
  blockingRules: Dict<BlockingRule, string>
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    blockingRules: Schema.dict(Schema.object({
      enable: Schema.boolean().description('是否启用').default(true),
      blockingWords: Schema.array(String).description('违禁词列表 (可使用正则表达式)').default([]),
      mute: Schema.boolean().description('检测到违禁词后是否禁言').default(false),
      muteDuration: Schema.natural().role('ms').description('禁言时长 (单位为毫秒)').default(10 * Time.minute),
      recall: Schema.boolean().description('检测到违禁词后是否撤回').default(false)
    }).description('群组平台与群组 ID, 格式:`platform:guildId`, 例如:`red:123456`')).description('规则列表'),
  }).description('违禁词检测')
])

export const usage: string = `
使用本插件的指令，需要用户的权限等级为 3 及以上（自我禁言除外）。

权限设置教程: [https://koishi.chat/zh-CN/manual/usage/customize.html#%E7%94%A8%E6%88%B7%E6%9D%83%E9%99%90](https://koishi.chat/zh-CN/manual/usage/customize.html#%E7%94%A8%E6%88%B7%E6%9D%83%E9%99%90)
`

export function apply(ctx: Context, cfg: Config) {
  ctx.middleware(async (session, next) => {
    if (session.gid in cfg.blockingRules) {
      const rule = cfg.blockingRules[session.gid]
      if (!rule.enable) return next()

      let hits = false
      for (const word of rule.blockingWords) {
        const include = session.event.message.elements.some(value => {
          if (value.type === 'text') {
            return new RegExp(word).test(value.attrs.content)
          }
          return false
        })

        if (include) {
          hits = true
          break
        }
      }

      if (hits) {
        await session.send('检测到违禁词')
        const { event } = session
        if (rule.recall) {
          await session.bot.deleteMessage(event.channel.id, event.message.id)
          await session.send('已执行撤回')
        }
        if (rule.mute) {
          await session.bot.muteGuildMember(event.guild.id, event.user.id, rule.muteDuration)
          await session.send('已执行禁言')
        }
        return
      }
    }
    return next()
  })

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

    command.subcommand('self-ban <duration:number> <type>', '禁言自己')
    .usage('示例：self-ban 1 分钟')
    .alias('自我禁言')
    .action(async ({ session }, duration, type) => {
      if (!duration) return '请指定禁言时长'
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
      await session.bot.muteGuildMember(session.guildId, session.event.user.id, duration)
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
      if (!session.quote) return '请回复被撤回的消息'
      const msgId = session.quote.id || session.quote.messageId
      await session.bot.deleteMessage(session.channelId, msgId)
      return '已执行撤回'
    })

  command.subcommand('kick <user:user>', '将指定用户踢出群聊', { authority: 3 })
    .usage('示例：kick @user')
    .alias('踢')
    .alias('踢出群聊')
    .action(async ({ session }, user) => {
      if (!user) return '请指定被踢出群聊的用户'
      const [platform, userId] = user.split(':')
      await session.bot.kickGuildMember(session.guildId, userId)
      return '已执行踢出群聊'
    })
}
