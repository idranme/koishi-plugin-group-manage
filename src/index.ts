import { Context, Schema, Dict, Time } from 'koishi'

export const name = 'group-manage'

interface BlockingRule {
  enable: boolean
  blockingWords: string[]
  mute: boolean
  muteDuration: number
  recall: boolean
  tip: boolean
}

export interface Config {
  blockingRules: Dict<BlockingRule, string>
  banDuration: number
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    blockingRules: Schema.dict(Schema.object({
      enable: Schema.boolean().description('是否启用').default(true),
      blockingWords: Schema.array(String).description('违禁词列表 (可使用正则表达式)').default([]),
      mute: Schema.boolean().description('检测到违禁词后是否禁言').default(false),
      muteDuration: Schema.natural().role('ms').description('禁言时长 (单位为毫秒)').default(10 * Time.minute),
      recall: Schema.boolean().description('检测到违禁词后是否撤回').default(false),
      tip: Schema.boolean().description('是否在检测到违禁词后进行提示').default(true)
    }).description('群组平台与群组 ID, 格式:`platform:guildId`, 例如:`red:123456`')).description('规则列表'),
  }).description('违禁词检测设置'),
  Schema.object({
    banDuration: Schema.natural().role('ms').description('ban 和 ban-me 指令默认禁言时长 (单位为毫秒)').default(15 * Time.hour),
  }).description('指令默认值设置')
])

export const usage: string = `
使用本插件对他人进行操作时，需要操作者的权限等级 (authority) 为 3 及以上。

权限设置教程: https://koishi.chat/zh-CN/manual/usage/customize.html#%E7%94%A8%E6%88%B7%E6%9D%83%E9%99%90
`

export function apply(ctx: Context, cfg: Config) {
  ctx.i18n.define('zh-CN', require('./locales/zh-CN'))

  ctx.middleware(async (session, next) => {
    if (session.gid in cfg.blockingRules) {
      const rule = cfg.blockingRules[session.gid]
      if (!rule.enable) return next()

      let hit = false
      for (const word of rule.blockingWords) {
        const re = new RegExp(word)
        const include = session.event.message.elements.some(value => {
          if (value.type === 'text') {
            return re.test(value.attrs.content)
          }
          return false
        })
        if (include) {
          hit = true
          break
        }
      }

      if (hit) {
        rule.tip && await session.send(session.text('group-manage.blocking-word.hit'))
        const { event } = session
        if (rule.recall) {
          await session.bot.deleteMessage(event.channel.id, event.message.id)
          rule.tip && await session.send(session.text('group-manage.blocking-word.recall'))
        }
        if (rule.mute) {
          await session.bot.muteGuildMember(event.guild.id, event.user.id, rule.muteDuration)
          rule.tip && await session.send(session.text('group-manage.blocking-word.mute'))
        }
        return
      }
    }
    return next()
  })

  const command = ctx.command('group-manage')

  command.subcommand('ban <user:user> <duration:posint> <unit>', { authority: 3 })
    .alias('mute', '禁言')
    .action(async ({ session }, user, duration, unit) => {
      if (!user) return session.text('.missing-user')
      if (!duration) {
        duration = cfg.banDuration
      } else {
        duration = parseDuration(duration, unit)
        if (duration === undefined) return session.text('.missing-duration')
      }
      const userId = user.replace(session.platform + ':', '')
      await session.bot.muteGuildMember(session.guildId, userId, duration)
      return session.text('.executed')
    })

  command.subcommand('ban-me <duration:posint> <unit>')
    .alias('self-ban', 'mute-me', '自我禁言')
    .action(async ({ session }, duration, unit) => {
      if (!duration) {
        duration = cfg.banDuration
      } else {
        duration = parseDuration(duration, unit)
        if (duration === undefined) return session.text('.missing-duration')
      }
      await session.bot.muteGuildMember(session.guildId, session.userId, duration)
      return session.text('.executed')
    })

  command.subcommand('unban <user:user>', { authority: 3 })
    .alias('unmute', '取消禁言')
    .action(async ({ session }, user) => {
      if (!user) return session.text('.missing-user')
      const userId = user.replace(session.platform + ':', '')
      await session.bot.muteGuildMember(session.guildId, userId, 0)
      return session.text('.executed')
    })

  command.subcommand('delmsg', { authority: 3 })
    .alias('撤回消息')
    .action(async ({ session }) => {
      if (!session.quote) return session.text('.missing-quote')
      await session.bot.deleteMessage(session.channelId, session.quote.id)
      return session.text('.executed')
    })

  command.subcommand('kick <user:user>', { authority: 3 })
    .alias('踢', '踢出群聊')
    .action(async ({ session }, user) => {
      if (!user) return session.text('.missing-user')
      const userId = user.replace(session.platform + ':', '')
      await session.bot.kickGuildMember(session.guildId, userId)
      return session.text('.executed')
    })

  command.subcommand('mute-all', { authority: 3 })
    .alias('全员禁言')
    .action(async ({ session }) => {
      const { platform, guildId } = session
      switch (platform) {
        case 'red':
          await session.bot.internal.muteGroup({
            group: guildId,
            enable: true
          })
          break
        case 'onebot':
          await session.bot.internal.setGroupWholeBan(guildId, true)
          break
        case 'kritor':
          await session.bot.internal.setGroupWholeBan(guildId, true)
          break
        default:
          return session.text('.unsupported-platform')
      }
      return session.text('.executed')
    })

  command.subcommand('unmute-all', { authority: 3 })
    .alias('取消全员禁言')
    .action(async ({ session }) => {
      const { platform, guildId } = session
      switch (platform) {
        case 'red':
          await session.bot.internal.muteGroup({
            group: guildId,
            enable: false
          })
          break
        case 'onebot':
          await session.bot.internal.setGroupWholeBan(guildId, false)
          break
        case 'kritor':
          await session.bot.internal.setGroupWholeBan(guildId, false)
          break
        default:
          return session.text('.unsupported-platform')
      }
      return session.text('.executed')
    })
}

function parseDuration(duration: number, unit: string): number | undefined {
  switch (unit) {
    case '秒':
    case '秒钟':
    case 's':
      return duration * 1000
    case '分':
    case '分钟':
    case 'min':
      return duration * 60 * 1000
    case '时':
    case '小时':
    case 'h':
      return duration * 60 * 60 * 1000
    case '天':
    case 'd':
      return duration * 24 * 60 * 60 * 1000
    default:
      return undefined
  }
}