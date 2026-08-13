## Why

当前仓库只有一份覆盖面很广的 README 架构草案。它明确了产品方向，却没有把保存语义、信任边界、数据库不变量、错误行为和阶段验收条件收敛为机器可验证的契约；直接交给低成本模型实现，容易得到彼此冲突、无法端到端运行或存在数据隔离风险的代码。

本变更将 README 升级为 ChatStash MVP 的 OpenSpec 技术基线，在不扩大产品范围的前提下，补齐可观察需求、架构决策和按依赖排序的实现清单。

## What Changes

- 将 MVP 的保存单位明确为“一条用户消息 + 与其对应的一条已完成助手消息”的不可变快照，而不是抓取或同步整个来源会话。
- 将扩展拆分为页面采集层、Adapter 层、后台可信服务层和注入 UI 层；令牌与 Supabase 网络请求只存在于扩展后台上下文。
- 使用版本化 PostgreSQL RPC 在单事务中保存 conversation 与 messages，并通过数据库唯一约束提供最终幂等保证。
- 明确 Web 与 Extension 使用同一个 Supabase 用户账号，但各自维护独立会话；MVP 认证限定为邮箱密码。
- 明确六个核心实体的字段职责、同用户引用约束、RLS、索引、级联删除和文件夹删除/防环行为。
- 将 Markdown 设为唯一持久化正文；MVP 不保存来源 HTML，也不启用原始 HTML 渲染。
- 保留 PostgreSQL 内搜索，同时为英文分词与中文/片段匹配设计可预测的双路径，不引入外部搜索服务。
- 将原先 13 个宽泛步骤重排为有依赖、有文件边界、有自动化验证、有人工验收门槛的交付阶段。
- 延后专用 Settings 页面、数学公式渲染、拖拽排序、离线队列、OAuth/魔法链接、HTML fallback、健康监控后台和更多站点。
- 不修改 README 原始草案；通过评审记录、规范、设计和任务文档形成新的实现依据。
- 不包含破坏性运行时变更；当前仓库尚无业务代码、线上 schema 或需要迁移的用户数据。

## Non-Goals

- 本 change 不实现业务代码，也不部署 Supabase、Web 或 Extension。
- MVP 不保存或同步来源站点的完整多轮会话，不支持更新已经保存的快照。
- MVP 不引入独立 API 服务、Edge Function、队列、缓存、搜索集群、向量库或对象存储。
- MVP 不支持 OAuth、magic link、离线保存、分享、协作、批量操作、更多站点或原始 HTML 渲染。

## Capabilities

### New Capabilities

- `identity-and-access`: Web 与 Extension 登录、会话、RLS 数据隔离及最小权限边界。
- `conversation-capture`: 单次问答提取、Markdown 载荷、原子保存、幂等与保存反馈。
- `site-adapters`: ChatGPT 与 DeepSeek 的 URL 匹配、DOM 发现、配对、流式状态和生命周期行为。
- `conversation-library`: Dashboard 的收藏列表、详情、分页、来源信息与删除行为。
- `content-organization`: 无限层级文件夹、标签、移动、筛选、防环和删除语义。
- `conversation-search`: 标题与 Markdown 正文的用户隔离搜索和结果排序。
- `markdown-export`: 单篇收藏的确定性 Markdown 导出和安全文件名。

### Modified Capabilities

无。仓库中尚无已部署的 OpenSpec capability。

## Impact

- 新增 `openspec/` 作为需求、设计和实现计划的版本化来源。
- 后续实现将新增 `apps/extension`、`apps/web`、`packages/shared`、`packages/adapters` 和 `supabase`。
- 浏览器公开配置只包含 Supabase URL 与 publishable/anon key；数据库授权依赖 Auth JWT、RLS、约束和显式 grant。
- 新增运行时依赖前，实施者必须说明用途并锁定版本；初始基线不引入独立 API 服务、队列、缓存、向量库或搜索集群。
- 这是绿地 MVP 的规划变更，不包含业务代码或数据迁移，因此当前无运行时破坏性影响。
