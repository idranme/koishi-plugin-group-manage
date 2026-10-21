import { Context, Schema, Dict, Time, noop, h } from 'koishi'

export const name = 'group-manage'

interface BlockingRule {
  enable: boolean
  blockingWords: string[]
  matchMode: 'text' | 'all'
  mute: boolean
  muteDuration: number
  recall: boolean
  tip: boolean
}

export interface Config {
  blockingRules: Dict<BlockingRule, string>
  banDuration: number
  enableQuote: boolean
  enableCaptureQuoteArg: boolean
  enableBan: boolean
  enableBanMe: boolean
  enableBatchDelMsg: boolean
  enableDelMsg: boolean
  enableKick: boolean
  enableMuteAll: boolean
  enableUnban: boolean
  enableUnmuteAll: boolean
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    enableQuote: Schema.boolean().description('发送消息时是否引用触发指令的消息').default(true),
  }).description('消息设置'),
  Schema.object({
    enableCaptureQuoteArg: Schema.boolean().description('是否捕获被引用消息的文本作为指令参数 (关闭可防止引用消息执行指令时参数被引用内容污染)').default(false),
  }).description('指令设置'),
  Schema.object({
    enableBan: Schema.boolean().description('启用 ban (禁言) 指令').default(true),
    enableBanMe: Schema.boolean().description('启用 ban-me (自我禁言) 指令').default(true),
    enableUnban: Schema.boolean().description('启用 unban (取消禁言) 指令').default(true),
    enableDelMsg: Schema.boolean().description('启用 del-msg (撤回消息) 指令').default(true),
    enableBatchDelMsg: Schema.boolean().description('启用 batch-del-msg (批量撤回消息) 指令').default(true),
    enableKick: Schema.boolean().description('启用 kick (踢出群聊) 指令').default(true),
    enableMuteAll: Schema.boolean().description('启用 mute-all (开启全员禁言) 指令').default(true),
    enableUnmuteAll: Schema.boolean().description('启用 unmute-all (取消全员禁言) 指令').default(true),
  }).description('指令管理'),
  Schema.object({
    blockingRules: Schema.dict(Schema.object({
      enable: Schema.boolean().description('是否启用').default(true),
      blockingWords: Schema.array(String).description('违禁词列表 (可使用正则表达式)').default([]),
      matchMode: Schema.union([
        Schema.const('text').description('仅匹配文本'),
        Schema.const('all').description('匹配全部'),
      ]).description('匹配模式').default('text'),
      mute: Schema.boolean().description('检测到违禁词后是否禁言').default(false),
      muteDuration: Schema.natural().role('ms').description('禁言时长 (单位为毫秒)').default(10 * Time.minute),
      recall: Schema.boolean().description('检测到违禁词后是否撤回').default(false),
      tip: Schema.boolean().description('是否在检测到违禁词后进行提示').default(true)
    }).description('群组平台与群组 ID, 格式:`platform:guildId`, 例如:`red:123456`')).description('规则列表'),
  }).description('违禁词检测设置'),
  Schema.object({
    banDuration: Schema.natural().role('ms').description('ban 和 ban-me 指令默认禁言时长 (单位为毫秒)').default(1 * Time.minute),
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
        let include
        if (rule.matchMode === 'text') {
          include = session.event.message!.elements!.some(value => {
            if (value.type === 'text') {
              return re.test(value.attrs.content)
            }
            return false
          })
        } else {
          include = re.test(session.content!)
        }
        if (include) {
          hit = true
          break
        }
      }

      function sendTip(path: string) {
        if (!rule.tip) return
        const text = session.text(path)
        return session.send(cfg.enableQuote && session.messageId ? h('message', h.quote(session.messageId), text) : text)
      }

      if (hit) {
        await sendTip('group-manage.blocking-word.hit')
        const { event } = session
        if (rule.recall) {
          await session.bot.deleteMessage(event.channel!.id, event.message!.id!)
          await sendTip('group-manage.blocking-word.recall')
        }
        if (rule.mute) {
          await session.bot.muteGuildMember(event.guild!.id, event.user!.id, rule.muteDuration)
          await sendTip('group-manage.blocking-word.mute')
        }
        return
      }
    }
    return next()
  })

  function reply(session: any, path: string) {
    const text = session.text(path)
    return cfg.enableQuote && session.messageId ? h('message', h.quote(session.messageId), text) : text
  }

  const command = ctx.command('group-manage', { captureQuote: cfg.enableCaptureQuoteArg })
    .alias('groupmanage')

  if (cfg.enableBan) {
    command.subcommand('ban <user:user> <duration:posint> <unit>', { authority: 3, captureQuote: cfg.enableCaptureQuoteArg })
      .alias('mute', '禁言')
      .action(async (argv, user, duration, unit) => {
        const session = argv.session!
        if (!user) return reply(session, '.missing-user')
        if (!duration) {
          duration = cfg.banDuration
        } else {
          const parsed = parseDuration(duration, unit)
          if (parsed === undefined) return reply(session, '.missing-duration')
          duration = parsed
        }
        const userId = user.replace(session.platform + ':', '')
        await session.bot.muteGuildMember(session.guildId!, userId, duration)
        return reply(session, '.executed')
      })
  }

  if (cfg.enableBanMe) {
    command.subcommand('ban-me <duration:posint> <unit>', { captureQuote: cfg.enableCaptureQuoteArg })
      .alias('banme', 'self-ban', 'mute-me', '自我禁言')
      .action(async (argv, duration, unit) => {
        const session = argv.session!
        if (!duration) {
          duration = cfg.banDuration
        } else {
          const parsed = parseDuration(duration, unit)
          if (parsed === undefined) return reply(session, '.missing-duration')
          duration = parsed
        }
        await session.bot.muteGuildMember(session.guildId!, session.userId!, duration)
        return reply(session, '.executed')
      })
  }

  if (cfg.enableUnban) {
    command.subcommand('unban <user:user>', { authority: 3, captureQuote: cfg.enableCaptureQuoteArg })
      .alias('unmute', '取消禁言')
      .action(async (argv, user) => {
        const session = argv.session!
        if (!user) return reply(session, '.missing-user')
        const userId = user.replace(session.platform + ':', '')
        await session.bot.muteGuildMember(session.guildId!, userId, 0)
        return reply(session, '.executed')
      })
  }

  if (cfg.enableDelMsg) {
    command.subcommand('del-msg', { authority: 3, captureQuote: cfg.enableCaptureQuoteArg })
      .alias('delmsg', '撤回消息')
      .action(async (argv) => {
        const session = argv.session!
        if (!session.quote) return reply(session, '.missing-quote')
        await session.bot.deleteMessage(session.channelId!, session.quote.id!)
        return reply(session, '.executed')
      })
  }

  if (cfg.enableBatchDelMsg) {
    command.subcommand('batch-del-msg <count:posint>', { authority: 3, captureQuote: cfg.enableCaptureQuoteArg })
      .alias('batchdelmsg', '批量撤回消息')
      .action(async (argv, count) => {
        const session = argv.session!
        if (count === undefined) return reply(session, '.missing-count')
        if (typeof session.bot.getMessageList !== 'function') {
          return reply(session, '.unsupported-history')
        }
        try {
          const msgList = []
          let next: string | undefined
          let exclude: string | undefined
          while (msgList.length < count) {
            const list = await session.bot.getMessageList(session.channelId!, next)
            if (!list?.data || list.data.length === 0) break
            msgList.unshift(...list.data.filter(e => e.id !== exclude))
            if (list.next) {
              next = list.next
            } else {
              exclude = list.data[0]?.id
              next = list.data[0]?.id
            }
          }
          for (const msg of msgList.slice(-count)) {
            session.bot.deleteMessage(msg.channel?.id || session.channelId!, msg.id!).catch(noop)
          }
          return reply(session, '.executed')
        } catch (error) {
          ctx.logger('group-manage').warn('批量撤回消息失败:', error)
          return reply(session, '.failed')
        }
      })
  }

  if (cfg.enableKick) {
    command.subcommand('kick <user:user>', { authority: 3, captureQuote: cfg.enableCaptureQuoteArg })
      .alias('踢', '踢出群聊')
      .action(async (argv, user) => {
        const session = argv.session!
        if (!user) return reply(session, '.missing-user')
        const userId = user.replace(session.platform + ':', '')
        await session.bot.kickGuildMember(session.guildId!, userId)
        return reply(session, '.executed')
      })
  }

  if (cfg.enableMuteAll) {
    command.subcommand('mute-all', { authority: 3, captureQuote: cfg.enableCaptureQuoteArg })
      .alias('muteall', '全员禁言')
      .action(async (argv) => {
        const session = argv.session!
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
          case 'qq':
            if (typeof session.bot.muteChannel === 'function') {
              await session.bot.muteChannel(session.channelId!, guildId, true)
            } else {
              await session.bot.internal.setRestrictChatSetting(guildId, {
                global_rule: {
                  mode: 'always',
                },
              })
            }
            break
          default:
            return reply(session, '.unsupported-platform')
        }
        return reply(session, '.executed')
      })
  }

  if (cfg.enableUnmuteAll) {
    command.subcommand('unmute-all', { authority: 3, captureQuote: cfg.enableCaptureQuoteArg })
      .alias('unmuteall', '取消全员禁言')
      .action(async (argv) => {
        const session = argv.session!
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
          case 'qq':
            if (typeof session.bot.muteChannel === 'function') {
              await session.bot.muteChannel(session.channelId!, guildId, false)
            } else {
              await session.bot.internal.setRestrictChatSetting(guildId, {
                global_rule: {
                  mode: 'none',
                },
              })
            }
            break
          default:
            return reply(session, '.unsupported-platform')
        }
        return reply(session, '.executed')
      })
  }
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
