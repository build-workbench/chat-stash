# ChatStash README 设计评审

## 结论

README 已经是一份质量较高的产品输入：目标用户、MVP 边界、技术栈、Adapter 思路、安全意识和分阶段交付原则都正确。它目前更像“给高级模型的总提示词”，还不是能直接驱动实现的工程规范。主要问题不是缺少功能，而是若干关键语义仍有多种合理解释；这些歧义会让不同实现阶段产生不兼容的代码。

推荐保留 README 作为产品愿景与原始约束，把 `openspec/changes/establish-chatstash-mvp/` 作为 MVP 实现基线。若两者存在冲突，实现时以已评审的 OpenSpec 文档为准。

## 值得保留的设计

1. **MVP 和非目标清楚。** 没有把协作、RAG、支付、移动端等长期功能塞入首版。
2. **Markdown First 正确。** 它使展示、搜索和导出共享同一份正文，避免双格式漂移。
3. **Adapter Pattern 必要。** AI 站点 DOM 差异和变化频繁，平台逻辑必须与保存流程隔离。
4. **Supabase + RLS 适合首版。** 身份、数据库和 Data API 可以形成最短的端到端路径。
5. **数据模型没有退化为 prompt/response 大字段。** `conversations + messages` 为后续多轮保存留出了自然演进路径。
6. **安全要求方向正确。** 已明确禁止 service role key、`<all_urls>` 和关闭 RLS。
7. **测试重点选择正确。** DOM fixture、Markdown 转换、RLS 和参数校验正是高风险边界。

## 必须升级的设计点

| 优先级 | README 中的歧义或缺口 | 可能后果 | 升级后的决定 |
| --- | --- | --- | --- |
| P0 | “Conversation”可能指单条问答，也可能指来源页面的整段会话 | 重复键、列表语义和消息写入方式互相冲突 | MVP 每次点击只保存目标 assistant 回复及其最近的对应 user prompt，形成一个两消息快照 |
| P0 | “CRUD API”未说明是 Next API、Edge Function 还是 Supabase Data API | 重复后端层，或先写 conversation 后写 messages 导致半成品 | 常规 CRUD 使用 Supabase Data API；保存使用 `save_capture_v1` 数据库 RPC 保证单事务 |
| P0 | 扩展令牌和网络请求所在上下文未定义 | content script 暴露令牌、CORS 混乱、权限扩大 | Supabase client、会话和跨域请求只在 MV3 background service worker；content script 只发已验证消息 |
| P0 | 防重复只有候选字段，没有权威算法和并发行为 | 双击或重试仍可能产生两份数据 | Adapter 稳定 ID 优先、内容哈希兜底形成 `dedupe_key`；数据库唯一约束为最终裁决，重复返回已有 ID |
| P0 | 只提出 RLS，没有规定跨表引用必须同属一个用户 | 用户可能把自己的记录关联到别人的 folder/tag/conversation ID | 除 RLS 外使用 `user_id`、组合外键/触发器和数据库测试保证同用户引用 |
| P1 | 文件夹删除策略没有决定 | 误删整棵树或产生悬空引用 | 删除一个文件夹时，其直接子文件夹提升到被删节点的父级，直接收藏移到 All Saves；整个操作原子执行 |
| P1 | 无限层级只描述了自引用，没有防环算法 | 递归 UI/查询无法终止 | 父级变更由数据库验证：不能指向自身或任一后代；UI 过滤非法候选但数据库是权威防线 |
| P1 | Web 与 Extension “共享身份”可能被误解为共享浏览器 Cookie | 容易实现脆弱的 Cookie 桥或不安全 token 传递 | 二者共享 Supabase user id，但分别持久化、刷新和注销各自会话 |
| P1 | 认证方式未选定 | OAuth redirect、magic link 和密码流程混杂 | MVP 采用邮箱密码；注册、验证邮箱和找回密码由 Web 负责，Extension 只登录/注销 |
| P1 | Markdown 与可选 HTML 并存但没有一致性规则 | 两份正文漂移，扩大 XSS 面 | MVP 只保存 Markdown；Dashboard 不启用 raw HTML，HTML fallback 延后 |
| P1 | PostgreSQL FTS 对中文体验没有说明 | 中文长文本可能无法按用户预期命中 | 英文/分词查询使用 `simple` FTS，中文和片段使用 `pg_trgm`/受控 substring fallback，仍全部留在 PostgreSQL |
| P1 | Adapter 接口混合 DOM 发现、抽取、挂载和运行时生命周期 | 每个 Adapter 各自创建 observer，最终泄漏或重复注入 | Adapter 只描述平台差异；核心 runtime 唯一拥有 observer、路由重启、去抖和 UI 状态机 |
| P1 | 未限制 payload 大小和 URL 内容 | 异常大记录、敏感参数或凭据被保存 | 共享 schema 与数据库约束限制长度；来源 URL 按 Adapter 规则只保留允许 host、会话定位所需 path 与显式白名单 query，移除凭据、fragment 和其他参数 |
| P2 | `packages/shared`、`packages/types` 职责重复 | 循环依赖和类型来源不唯一 | 只保留 `packages/shared`（纯数据契约）与 `packages/adapters`（DOM 能力） |
| P2 | 13 个阶段中 Auth 和真实保存过晚 | 前期 mock 架构可能无法适配真实会话与 RPC | 数据库之后先完成 workspace，再完成共享契约、后台认证/保存纵切，随后逐站点实现 Adapter |
| P2 | “Adapter health check”容易演变成产品子系统 | 在 MVP 中投入监控后台和遥测 | 仅保留开发期诊断结果与统一日志，不做远程健康平台 |

## 升级后的系统边界

```text
ChatGPT / DeepSeek 页面（不可信 DOM）
        │ 用户主动点击、Adapter 提取
        ▼
Extension Content Script（无 token、无跨域数据权限）
        │ 有限且经过 schema 校验的 runtime message
        ▼
Extension Background Service Worker（会话与网络边界）
        │ publishable key + 用户 JWT
        ▼
Supabase Auth / Data API / PostgreSQL RPC
        │ 约束 + RLS + 同用户外键
        ▼
PostgreSQL
        ▲
        │ SSR cookie + 用户 JWT
Next.js Dashboard（列表、组织、搜索、导出）
```

扩展不自动上传页面内容；只有用户点击目标回复旁的保存按钮后，才提取和发送该次问答。Web 不接收扩展令牌，Extension 也不读取 Web Cookie。

## MVP 应保留、简化和延后

### 保留

- ChatGPT 与 DeepSeek 两个 Adapter。
- 邮箱密码登录、用户数据隔离和 RLS 自动化测试。
- 单次问答保存、列表、详情、文件夹、标签、筛选、基础搜索和单篇导出。
- 无限层级的数据模型和树形展示，但不做拖拽。
- GFM、安全 Markdown 渲染和代码高亮。

### 简化

- 文件夹通过“选择父文件夹”移动，不做拖拽或任意排序 UI。
- 搜索只接受一段文本，不做高级查询构造器、搜索建议或高亮摘要。
- Adapter 健康检查只输出不含正文的开发诊断。
- 列表采用固定游标分页与简单排序，不做虚拟列表和复杂视图。
- Extension 只显示本次页面生命周期内的保存状态，不预取整页远端保存状态。

### 延后

- 保存原始 HTML、数学公式渲染、整段会话同步、更新已保存快照。
- OAuth、magic link、Web 到 Extension 的自动会话传递。
- 离线队列、自动重试后台任务、跨设备浏览器状态同步。
- Settings 专页、批量导出、批量操作、分享和协作。
- 更多站点、远程 Adapter 配置、遥测和健康监控后台。

## 技术栈评审

核心技术栈不需要更换，建议做以下收敛：

- 使用 **pnpm workspace**，初期不引入 Turborepo；递归脚本足以支撑两个 app 和两个 package。
- Web 继续使用 Next.js App Router；Supabase SSR 使用官方当前推荐的 cookie 客户端方案。
- Extension 继续使用 Plasmo，但只让 Plasmo 负责 MV3 构建、content-script UI 和消息接线；领域契约不依赖框架。
- Supabase publishable key 是公开客户端配置，不是秘密；所有授权必须落在 RLS/数据库约束。兼容旧项目时才使用 legacy anon key。
- 不新增独立 Node API、Supabase Edge Function、搜索服务、缓存或消息队列。

## Architecture Decision Summary

| 决策 | 基线 |
| --- | --- |
| 保存单位 | 一条 prompt + 对应的一条已完成 response 的不可变快照 |
| 后端入口 | Supabase Data API；保存、文件夹删除、搜索等多步操作使用版本化 RPC |
| 扩展信任边界 | content script 采集，background 持有会话并联网 |
| 身份 | Web 与 Extension 共用账号，不共用会话；MVP 邮箱密码 |
| 数据正文 | 只持久化 Markdown，不持久化来源 HTML |
| 幂等 | UI pending 锁 + 确定性 dedupe key + 数据库唯一约束 |
| 数据隔离 | RLS + 显式 grant + user_id 索引 + 同用户引用约束 + pgTAP |
| 文件夹删除 | 子文件夹提升一级，收藏移到 All Saves，不级联删除内容 |
| 搜索 | PostgreSQL FTS + PostgreSQL trigram/substring fallback |
| Monorepo | pnpm workspace；`apps/extension`、`apps/web`、`packages/shared`、`packages/adapters` |
| MVP UI | Sidebar + List + Viewer；无拖拽、无复杂设置页 |
| 交付方法 | 严格按 OpenSpec `tasks.md` 的阶段和验收门槛推进 |
