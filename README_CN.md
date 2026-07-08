# status

[English](README.md) | [中文](README_CN.md)

一个极简的自建可用性监控工具：一个 Cloudflare Worker 按计划检查一批 TCP 端口，把每次结果都记录到 D1，并提供一个状态页、每个监控项的详情页、一个用来管理监控项的管理界面/API，以及状态变化时的推送通知。不依赖任何外部监控服务，也不需要自己维护服务器——完全跑在 Cloudflare 的免费额度上。

设计上是一个通用工具，不绑定任何具体项目：监控什么完全存在 D1 里（一张 `targets` 表），全部通过管理界面/API 来管理——增加、编辑、删除监控项都不需要改代码或重新部署。以后要用在别的项目上，直接换一批监控目标就行，用的还是这同一个 Worker。

## 为什么会有这个项目

最初是想做一个自建版的 UptimeRobot 替代品，因为被监控的东西（IP 会偶尔漂移的代理服务器）需要的是 TCP 层面的检查（"这个端口是不是真的能连上"），而不是 HTTP 检查——而且从个人电脑上运行检查这件事本身并不可靠（本地的 VPN 客户端可能会干扰检查结果）。把检查这一步放到 Cloudflare 的边缘节点上运行，而不是依赖某一台具体的机器，就完全绕开了这个问题。

## 工作原理

- **`targets` 表（D1）**——要监控什么：`{ name, type, host, port, config, paused, tags, notes }`。通过管理界面/API 管理，不是写在源码文件里。
- **三种监控类型：**
  - **Port（TCP）**——用 Workers 的 `cloudflare:sockets` API（`connect()`）尝试发起一次原始 TCP 连接，带超时，并计时连接耗时。这跟本地 `nc -z` 做的是同一件事——只能证明端口是开着的、能连上（以及连接速度），不代表应用层一定正常。
  - **HTTP**——对一个 URL 发起普通的 `fetch()`。默认"正常"的判断标准是 `res.ok`（2xx-3xx）；也可以选择要求一个精确的状态码，和/或响应内容里必须出现某个关键词。
  - **DNS**——通过 DNS-over-HTTPS（用的是 Cloudflare 自己的解析服务，`cloudflare-dns.com/dns-query`）解析一个域名——不需要用到原始 DNS 协议，反正 Workers 运行环境本来也不支持。默认"正常"的判断标准是至少解析出一条记录；也可以要求解析结果里包含某个指定的值（比如 A 记录必须是某个具体 IP）。
  - 特意**没有实现**：Ping/ICMP 和 UDP 监控——Workers 的 socket API 只支持 TCP，压根没有原始 ICMP/UDP 的访问能力。同样跳过的还有 Cron/心跳监控（这是完全不同形态的检查方式——"被动等待上报"而不是"主动轮询"）和结构化的 API/JSON 断言监控（真要做会很复杂，而 HTTP + 关键词已经能覆盖实际需求）。
  - `host` 这个字段在所有类型里都兼职当作主要标识符（HTTP 是 URL，DNS 是域名，Port 是 TCP 主机名）；`config`（JSON）只存放每种类型各自需要的少量额外字段（HTTP 是 `expectedStatus`/`keyword`，DNS 是 `recordType`/`expectedValue`）。
- **Cron Trigger**（`wrangler.toml` 里的 `[triggers]`）——按计划（默认每分钟一次）触发 Worker 的 `scheduled()` 处理函数执行检查，会跳过标记为暂停的监控项。一个刚加进来、一次检查都还没跑过的监控项，会显示"待检查"，而不是"异常"。
- **D1**——每一次检查结果（不管正常还是异常，带延迟数据）都记录成一行，所以 uptime 百分比、故障历史、响应时间都是从真实数据算出来的，不只是"当前状态"。
- **状态页**（`/`）——每个目标当前的状态、24 小时/7 天的 uptime 百分比、距离上次故障过去多久，还带一个搜索框（匹配名称/host/标签）和可点击的标签。另外还有一个 `/api/status` JSON 接口。
- **故障页**（`/incidents`）——把所有监控项的故障都汇总在一起，按最新排序（不像单个监控详情页那样只看 24 小时窗口），每条故障都带"Root Cause（根本原因）"（见下面），也可以按名称搜索。公开、只读。
- **单个监控项的详情页**（`/monitor/:id`）——当前状态以及维持这个状态多久了、24 小时/7 天/30 天的 uptime 百分比（附带每个时间窗口的故障次数和总停机时长）、响应时间的平均值/最小值/最大值加一个简单的图表，以及最近的故障记录表。跟状态页一样，公开、只读。
- **Root Cause（根本原因）**——每次检查失败都会记录一个简短的原因（比如 `"Timeout"`、`"HTTP 503 Service Unavailable"`、`"Keyword not found in response"`、`"No A records found"`、`"Resolved value doesn't match expected '1.2.3.4'"` 等等），存在每一条检查记录里，故障页上显示的是触发这次故障的那一条检查的原因。
- **Reset（重置，仅管理员可用）**——清空单个监控项的检查历史（uptime 百分比、故障记录、响应时间统计全部都是从这些历史数据实时算出来的，所以清空历史就等于完全"从头开始"），但不会动这个监控项本身的名称/类型/配置/标签/备注。适合在一次已知的、预期内的故障之后用（比如你自己故意把某台服务器关机重启过），不然这次故障会永久性地拉低这个监控项的统计数据。
- **标签（Tags）**——每个监控项可以打上几个简短的公开标签（逗号分隔），会在所有页面上显示成小标签，可以搜索、也可以点击直接筛选。
- **备注（Notes）**——一个自由填写的文本字段，给自己留个提醒用的（这个监控项是干什么的、相关背景之类），支持简单的**加粗**/*斜体*/下划线/~~删除线~~（用轻量级的文本标记实现，不是存原始 HTML——文本会先转义再套用格式标记，所以不管填什么都不可能注入真正的 HTML）。**只有管理员能看到：状态页、`/api/status`、`/monitor/:id` 都不会暴露这个字段。**
- **管理界面**（`/admin`）——在一个页面里添加、编辑、暂停/恢复、删除监控项，可以搜索，还能发一条测试通知。用一个 bearer token 保护。
- **管理 API**（`/admin/api/*`）——跟界面上一样的操作，走普通 JSON 接口，方便写脚本调用。
- **Telegram + 邮件推送通知**——状态变化时（从正常变异常，或从异常恢复正常）Worker 会同时发一条 Telegram 消息和一封排版好的 HTML 邮件；两个通道各自独立（一个失败不会影响另一个），任意一个不配置就相当于禁用那一个。

## 搭建步骤

需要装好 `wrangler`（`npm install -g wrangler`，或者直接用机器上已经装好的），并且登录你自己的 Cloudflare 账号。

1. **创建 D1 数据库：**
   ```bash
   wrangler d1 create status-uptime
   ```
   把它打印出来的 `database_id` 填进 `wrangler.toml`。

2. **执行数据库迁移：**
   ```bash
   wrangler d1 migrations apply status-uptime --remote
   ```
   `migrations/0001_init.sql` 建 `checks` 表。`0002_targets_and_latency.sql` 加 `targets` 表（会预置几条示例数据——部署完之后自己去管理界面编辑/删除掉）以及延迟统计相关的字段。`0003_tags_and_notes.sql` 加标签/备注字段。`0004_monitor_types.sql` 加 HTTP、DNS 监控需要的 `type`/`config` 字段。`0005_fail_reason.sql` 加故障页要用到的失败原因字段。

3. **编辑 `wrangler.toml`：**
   - `[[routes]]` 的 `pattern`——你想让状态页跑在哪个域名下（必须是你 Cloudflare 账号里已有的某个 zone 下的域名；`custom_domain = true` 会在部署时自动处理好 DNS 记录，不用手动配置）。
   - `[triggers]` 的 `crons`——多久检查一次（cron 表达式；`*/1 * * * *` 表示每分钟一次）。

4. **设置管理员 token**（`/admin` 和 `/admin/api/*` 要能正常工作，这一步是必须的）：
   ```bash
   echo "your-chosen-token" | wrangler secret put ADMIN_TOKEN
   ```
   自己挑一个随机一点的字符串——自己生成，然后直接 pipe 进 `wrangler secret put`，不要经过任何可能会记录或回显它的地方，因为这个 token 掌握着监控项的全部管理权限。存成一个**密钥（secret）**，永远不要写进 `wrangler.toml`（这个仓库是公开的）。

5. **部署：**
   ```bash
   wrangler deploy
   ```

6. **管理监控项：** 访问 `https://<你的域名>/admin`，把管理员 token 粘贴进输入框（会存在浏览器的 `localStorage` 里，以后不用重复输入），然后就可以在这里添加/编辑/暂停/删除监控目标了。

7. **（可选）通过 Telegram 机器人开启状态变化推送通知：**
   - 在 Telegram 里找 **@BotFather**，发送 `/newbot`，跟着提示走完流程——它会回复一个机器人 token。
   - 找 **@userinfobot**，获取你自己的 Telegram 数字 chat ID（这个本身不算敏感信息——没有机器人 token 配合的话它什么也做不了——但终归是一个能定位到具体个人的标识符，所以也存成密钥，而不是直接写进这个公开仓库）。
   - 至少给你的新机器人发一条消息（Telegram 要求必须你先主动联系机器人，它才能反过来给你发消息）。
   - 把两个值都存成密钥：
     ```bash
     echo "your-bot-token" | wrangler secret put TELEGRAM_BOT_TOKEN
     echo "your-chat-id" | wrangler secret put TELEGRAM_CHAT_ID
     ```
   两个只要有一个没设置，通知功能就会完全禁用（代码里会检查这两个值，没有就直接跳过，不报错）；`ADMIN_TOKEN` 没设置的话也是同理——`/admin/api/*` 会永远返回 401。

   **为什么用 Telegram，不用 ntfy.sh：** 最初用的是 ntfy.sh，但后来发现它的免费额度是按来源 IP 限流的，不管你有没有做身份验证都一样——而 Cloudflare Workers 的出站流量是跟海量其他不相关用户/服务共用同一批出口 IP 的，这些人也在用同一批 IP 匿名往 ntfy.sh 发消息，所以这个共享额度早就被别人用光了，远远轮不到我们自己这点极少的用量。从个人电脑上发起的每一次测试都成功了，但从部署好的 Worker 里发出的每一条真实通知都悄无声息地因为 429 失败了，如果不特意加日志根本发现不了。Telegram 的 Bot API 没有这种"共享额度"的问题。

8. **（可选）再加上通过 [Resend](https://resend.com) 发送的邮件通知：**
   - 注册一个账号（免费额度就够用），生成一个 API key。
   - 把你的 API key 和接收通知的邮箱地址存成密钥：
     ```bash
     echo "your-resend-api-key" | wrangler secret put RESEND_API_KEY
     echo "your-email@example.com" | wrangler secret put OWNER_EMAIL
     ```
   - （可选）`RESEND_FROM`——自定义"发件人"地址，需要先在 Resend 里验证一个域名。不设置的话默认用 Resend 的沙盒发件地址（`onboarding@resend.dev`），不需要验证任何域名就能用。
   - Resend 对邮箱地址的校验很严格——如果报 `422 ... non-ASCII characters` 这样的错，说明复制粘贴的时候 `OWNER_EMAIL` 里混进了什么看不见的特殊字符，重新手动敲一遍再设置一次就好了。
   - Telegram 和邮件是相互独立的——配一个、两个都配，或者都不配，都可以。

就这么多——不需要服务器，不需要容器，不需要一台常开的机器。

## 需要注意的地方 / 局限性

- **Port 类型只做 TCP 层面的检查。** 只能确认"端口能不能连上"，不代表"这个端口背后的应用本身工作正常"。HTTP 类型补上了这一块（用来监控网站/API）；Port 类型继续用来监控代理、SSH、数据库这类服务就好。
- **D1 写入量。** 每次检查都会写一行（这是特意设计的，为了保留完整历史）——对少量目标、每分钟检查一次来说，完全在免费额度范围内；但如果要监控很多目标、检查频率又很高，可以考虑降低检查频率，或者只在状态变化时才写入。
- **静默的通知失败，是任何 webhook 类型集成都要小心的真实风险。** 不要用一个空的 `.catch(() => {})` 把通知请求的错误吞掉——失败时要把响应状态码/内容记下来，否则一个彻底失效的通知通道可能会长期没人发现（这个项目就真的踩过一次，见上面 ntfy.sh 那段说明）。
- **服务端校验要考虑到不同类型各自的"占位值"。** 对非 Port 类型的监控项来说，`port: 0` 是一个合法、故意设置的值（表示"不适用"）——如果校验逻辑写成简单的 `!body.port` 真值判断，就会把它当成"没填"给拒绝掉，因为 `0` 在 JS 里是 falsy。这个坑是真的踩过的：HTTP 监控项一度悄无声息地保存失败；后来改成只有 `type === "port"` 的时候才校验 port 必填。
- **一次检查都还没跑过的监控项，应该显示"待检查"，而不是"异常"。** 把还没检查过的目标默认显示成"异常"是明显会误导人的——一度看起来像是个 bug（明明正常的网站显示成 down），后来才发现只是刚加进去、还没等到下一次 Cron 触发（最多等 1 分钟）而已。
- **跟 UptimeRobot 完整版相比，故意没做的部分**：故障记录上的 Comments/Visibility 这两列，以及单独的 Status pages/Maintenance/Team members/Integrations 导航标签页——这些都是给多人协作团队用的功能，对一个人用的工具来说做了也没有对应的实际内容。
- **只有单一的观测点。** 检查始终是从 Cloudflare 调度 Cron Trigger 的地方发起的（不像付费版 UptimeRobot 那样分布在多个地区）——用来判断"这东西是不是能连上"没问题，不是用来检测特定地区的网络问题的。
- **管理员认证是单一共享 token**，不是分用户账号体系。个人使用没问题；如果以后需要多个人、不同权限级别地使用，那就得换成真正的认证方案（比如 Cloudflare Access）。
- **通知里的时间戳目前写死是 `Australia/Brisbane` 时区**（`src/time.js`），是专门为这次部署设置的。如果以后把这个 Worker 挪去监控别的、位于其他时区的项目，记得把那里的 `timeZone` 改掉——布里斯班这个地方常年不实行夏令时，所以"AEST"这个缩写也是写死的；换成一个会切换夏令时的时区的话，就得改成动态算出正确的缩写，不能再写死了。
