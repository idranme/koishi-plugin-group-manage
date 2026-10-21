# koishi-plugin-group-manage

[![npm](https://img.shields.io/npm/v/koishi-plugin-group-manage?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-group-manage)

群组管理工具，包含禁言、撤回消息、关键词检测等功能。

## 指令说明

> 注：涉及对他人操作的指令默认要求操作者的权限等级（authority）为 3 及以上。

| 指令 | 别名 | 权限要求 | 说明 | 用法示例 |
| :--- | :--- | :---: | :--- | :--- |
| `group-manage` | `groupmanage` | 3 | 群组管理根指令 | `group-manage` |
| `ban <user> [duration] [unit]` | `mute`, `禁言` | 3 | 禁言指定群成员 | `ban @user 10 分钟`<br>`ban @user 1 小时` |
| `ban-me [duration] [unit]` | `banme`, `self-ban`, `mute-me`, `自我禁言` | 无 | 禁言自己 | `ban-me 10 分钟`<br>`ban-me 1 小时` |
| `unban <user>` | `unmute`, `取消禁言` | 3 | 解除指定群成员的禁言 | `unban @user` |
| `del-msg` | `delmsg`, `撤回消息` | 3 | 撤回引用的单条消息 | 引用需撤回的消息并发送 `del-msg` |
| `batch-del-msg <count>` | `batchdelmsg`, `批量撤回消息` | 3 | 批量撤回最近指定条数的消息 | `batch-del-msg 10` |
| `kick <user>` | `踢`, `踢出群聊` | 3 | 将指定成员移出群聊 | `kick @user` |
| `mute-all` | `muteall`, `全员禁言` | 3 | 开启群全员禁言 | `mute-all` |
| `unmute-all` | `unmuteall`, `取消全员禁言` | 3 | 取消群全员禁言 | `unmute-all` |

## 配置项

### 消息设置

| 配置项 | 类型 | 默认值 | 说明 |
| :--- | :---: | :---: | :--- |
| `enableQuote` | `boolean` | `true` | 发送提示或执行反馈消息时，是否引用触发指令的消息 |

### 指令设置

| 配置项 | 类型 | 默认值 | 说明 |
| :--- | :---: | :---: | :--- |
| `enableCaptureQuoteArg` | `boolean` | `false` | 是否捕获被引用消息的文本作为指令参数（关闭可防止引用消息执行指令时参数被引用内容污染） |

### 指令管理

| 配置项 | 类型 | 默认值 | 说明 |
| :--- | :---: | :---: | :--- |
| `enableBan` | `boolean` | `true` | 是否启用 `ban`（禁言）指令 |
| `enableBanMe` | `boolean` | `true` | 是否启用 `ban-me`（自我禁言）指令 |
| `enableUnban` | `boolean` | `true` | 是否启用 `unban`（取消禁言）指令 |
| `enableDelMsg` | `boolean` | `true` | 是否启用 `del-msg`（撤回消息）指令 |
| `enableBatchDelMsg` | `boolean` | `true` | 是否启用 `batch-del-msg`（批量撤回消息）指令 |
| `enableKick` | `boolean` | `true` | 是否启用 `kick`（踢出群聊）指令 |
| `enableMuteAll` | `boolean` | `true` | 是否启用 `mute-all`（开启全员禁言）指令 |
| `enableUnmuteAll` | `boolean` | `true` | 是否启用 `unmute-all`（取消全员禁言）指令 |

### 违禁词检测设置

| 配置项 | 类型 | 默认值 | 说明 |
| :--- | :---: | :---: | :--- |
| `blockingRules` | `dict` | `{}` | 群组规则列表，键名格式为 `platform:guildId`（如 `qq:123456`、`red:123456`） |

### 指令默认值设置

| 配置项 | 类型 | 默认值 | 说明 |
| :--- | :---: | :---: | :--- |
| `banDuration` | `number` (ms) | `1 * Time.minute` | `ban` 和 `ban-me` 指令未指定时长时的默认禁言时长 |

## 本地开发调试

在 Koishi 工作区（Monorepo）中进行本地调试：

### 1. 克隆插件到 external 目录

```bash
git clone https://github.com/idranme/koishi-plugin-group-manage.git external/group-manage
```

### 2. 启动开发模式

在 Koishi 工作区根目录下执行安装与调试（无需符号连接符，多行命令适配 Windows / Linux）：

**使用 Yarn：**

```bash
yarn
yarn dev
```

**使用 npm：**

```bash
npm install
npm run dev
```
