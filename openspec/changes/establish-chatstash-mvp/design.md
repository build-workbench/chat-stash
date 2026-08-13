# ChatStash MVP 技术设计

## 1. 背景与设计目标

ChatStash 是绿地项目，当前没有需要兼容的业务代码或线上数据。本设计把 README 中的产品方向收敛为一个可以由低成本模型分阶段实现、由测试客观验收的 MVP。

设计目标：

- 先打通“页面点击 → 单次问答快照 → PostgreSQL → Dashboard”这一条纵向链路。
- 让平台 DOM 变化只影响对应 Adapter 和 fixture，不波及认证、保存与 Dashboard。
- 把用户隔离、跨表所有权、原子性和幂等放在数据库最终边界，而非仅依赖 UI。
- 只保留一个正文事实源（Markdown），缩小 XSS 与格式漂移面。
- 不引入首版不需要的常驻后端、队列、缓存、搜索集群或向量基础设施。

非目标：

- 不同步来源会话，也不追踪来源内容后续变化。
- 不保存一整个多轮聊天；一次保存只对应一组 prompt/response。
- 不在 MVP 中支持 OAuth、magic link、离线队列、分享、协作、批量能力或更多平台。
- 不保证任意网站 HTML 到 Markdown 的完美还原；只对启用的 Adapter fixture 建立契约。
- 不把 Adapter 远程更新、遥测或 DOM 健康监控做成服务。

## 2. 关键架构决策

| ID | 决策 | 理由 | 主要代价 |
| --- | --- | --- | --- |
| ADR-001 | 保存单位是不可变的单次问答快照 | 与“回复旁保存按钮”一致；幂等和列表语义清楚 | 同一来源会话会对应多条 ChatStash conversation |
| ADR-002 | 常规读写走 Supabase Data API，多行保存和文件夹删除走版本化数据库 RPC | 保留 BaaS 简洁性，同时保证关键操作单事务 | 少量 PL/pgSQL 需要单独测试 |
| ADR-003 | Extension background 是认证和网络边界 | content script 接触不可信页面；MV3 后台适合集中令牌和跨域权限 | 需要严格的消息契约与 worker 重启恢复 |
| ADR-004 | `user_id`、RLS、显式 grant 和同用户复合外键共同保护数据 | RLS 只解决行可见性，不能单独阻止跨用户 ID 关联 | migration 比简单 CRUD 多一些约束 |
| ADR-005 | MVP 只持久化 Markdown | 展示、搜索、导出共享一个事实源；减少 XSS 面 | 某些平台专有视觉结构只能降级为可读文本 |
| ADR-006 | Web 与 Extension 共用账号、不共用 session | 避免 Cookie/token 桥，注销和刷新行为可预测 | 用户首次需在两个客户端分别登录 |
| ADR-007 | PostgreSQL `simple` FTS 加 literal contains/`pg_trgm` | 英文 token 与中文片段均可用，仍不增加外部服务 | 索引会增加数据库空间，相关性不如专用搜索引擎 |
| ADR-008 | pnpm workspace，初期不使用 Turborepo | 两个 app、两个 package 的规模不需要额外任务编排层 | 项目变大后可能再引入缓存编排 |
| ADR-009 | 明确注册 Adapter，不做动态自动发现 | 构建行为透明、类型可检查、方便权限审计 | 新平台除新增文件外还需一条 registry、权限和 fixture 变更 |

## 3. 总体架构与信任边界

```text
┌─────────────────────────────────────────────────────────────────┐
│ 不可信页面：chatgpt.com / chat.deepseek.com                     │
│  页面 DOM ──► Adapter 提取 ──► 注入式 Save UI                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ 仅限 schema 校验后的消息；无 token
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Chrome Extension（MV3）                                         │
│  Background Service Worker                                      │
│  - chrome.storage.local 中的独立 Supabase session                │
│  - 消息发送者与 payload 校验                                     │
│  - 调用 Auth / save_capture_v1                                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS + publishable key + 用户 JWT
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase                                                        │
│  Auth ──► Data API / RPC ──► PostgreSQL                          │
│                    grants + constraints + RLS                    │
└───────────────────────────────▲─────────────────────────────────┘
                                │ HTTPS + publishable key + SSR cookie session
┌───────────────────────────────┴─────────────────────────────────┐
│ Next.js Dashboard                                                │
│  Server Components（读）/ Server Actions（写）/ Auth callback    │
│  不使用 privileged key                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 边界规则

1. AI 页面和从其 DOM 读取的所有值均不可信。
2. Content script 可以持有当前一次提取结果，但不能导入 Supabase client、读取 session storage 或执行任意后台操作。
3. Background 对每一种消息分别校验发送者、tab URL、平台与 payload；它不接受“任意 URL + 任意 HTTP 方法”一类通用代理消息。
4. Popup 通过 background 完成登录和注销；密码只在一次消息调用期间存在，不落盘、不进入日志。
5. 数据库从 `auth.uid()` 得到用户 ID；公开 RPC 不接受调用方提供的 `user_id`。
6. Web Server Action 每次重新验证用户，不能把隐藏表单字段或客户端缓存当作授权依据。

## 4. Monorepo 结构

```text
chat-stash/
├── apps/
│   ├── extension/
│   │   ├── background/
│   │   │   ├── index.ts
│   │   │   └── messages/
│   │   ├── contents/
│   │   │   └── chatstash.tsx
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── capture/
│   │   │   ├── messaging/
│   │   │   └── ui/
│   │   ├── popup.tsx
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
│       ├── app/
│       │   ├── (auth)/
│       │   ├── (dashboard)/
│       │   └── auth/callback/
│       ├── components/
│       ├── features/
│       │   ├── conversations/
│       │   ├── folders/
│       │   ├── tags/
│       │   ├── search/
│       │   └── export/
│       ├── lib/
│       │   ├── supabase/
│       │   └── validation/
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── contracts/
│   │   │   ├── database.types.ts
│   │   │   ├── errors.ts
│   │   │   ├── limits.ts
│   │   │   └── index.ts
│   │   └── test/
│   └── adapters/
│       ├── src/
│       │   ├── platforms/
│       │   ├── dom/
│       │   ├── markdown/
│       │   ├── registry.ts
│       │   └── types.ts
│       ├── fixtures/
│       └── test/
├── supabase/
│   ├── migrations/
│   ├── tests/database/
│   ├── config.toml
│   └── seed.sql
├── docs/
├── openspec/
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── tsconfig.base.json
```

依赖方向必须保持单向：

```text
apps/web ───────────► packages/shared
apps/extension ─────► packages/shared
apps/extension ─────► packages/adapters ─────► packages/shared

packages/shared 不依赖 React、DOM、Next.js、Plasmo 或 Supabase runtime。
packages/adapters 不依赖 Extension background 或 Dashboard。
```

不创建 `packages/types`：它与 `packages/shared` 职责重叠。暂不创建共享 UI 包：Web 与 Extension 的渲染环境、尺寸和组件体系不同，共享会制造耦合。

## 5. 领域语义与数据模型

### 5.1 保存语义

数据库中的 `conversation` 不是来源站点的完整会话镜像，而是用户在某个 assistant response 上点击 Save 时形成的快照容器。MVP 中每条 conversation 必须恰有两条 message：

```text
position 0: role=user       对应 prompt
position 1: role=assistant  被点击的 response
```

该快照不自动更新。未来支持整段会话时可以放宽 message 数量，不需要把表重新拆分。

### 5.2 关系图

```text
auth.users
   │ 1:1, delete cascade
profiles
   ├──< folders ──┐ self parent
   ├──< conversations ──< messages
   │          └──< conversation_tags >── tags
   └──────────────────── user_id ownership ──────────┘
```

### 5.3 表结构基线

所有时间使用 `timestamptz` 和数据库 UTC 时钟；展示时再按用户浏览器时区格式化。所有 UUID 由数据库默认生成，公开 RPC 不采信调用方的 owner ID。带 `updated_at` 的表共享一个简短的 `BEFORE UPDATE` trigger，只有数据库负责刷新该字段。

#### `profiles`

| 字段 | 约束 | 说明 |
| --- | --- | --- |
| `user_id` | UUID PK，FK → `auth.users.id ON DELETE CASCADE` | profile 的 owner key；不重复存 email |
| `created_at` | NOT NULL，默认 `now()` | 创建时间 |
| `updated_at` | NOT NULL，默认 `now()` | 预留 profile 扩展 |

Auth 用户创建触发器负责插入 profile；migration 同时回填触发器安装前已存在的用户。`profiles` 是“每个用户一行”的公共 ownership 根，因此这里使用 `user_id` 作为主键，不再增加等价的 `id`。

#### `folders`

| 字段 | 约束 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | Folder ID |
| `user_id` | NOT NULL，FK → profiles，`UNIQUE(user_id,id)` | Owner |
| `parent_id` | NULL 或 owned folder | NULL 表示根目录 |
| `name` | trim 后 1..80 字符，单行且无控制字符 | 展示名 |
| `name_normalized` | 数据库生成的 `lower(trim(name))` | 同级唯一性 |
| `sort_order` | int NOT NULL default 0 | 稳定显示；MVP 不提供拖拽 |
| `created_at`,`updated_at` | NOT NULL | 审计时间 |

使用 `(user_id,parent_id)` → `(user_id,id)` 复合外键保证父子同用户。使用 PostgreSQL 15+ 的 `UNIQUE NULLS NOT DISTINCT (user_id,parent_id,name_normalized)`，因此根目录的 NULL parent 也参与唯一性判断；同一父节点下不能存在仅大小写或首尾空白不同的重名。

父级变更触发器：

- 获取按 `user_id` 派生的 transaction-level advisory lock，使同一用户的并发层级修改串行化。
- 拒绝 `parent_id = id`。
- 从新父节点向上递归，若遇到当前 folder 则拒绝。
- 复合外键再保证新父节点属于同一用户。

#### `conversations`

| 字段 | 约束 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | ChatStash snapshot ID |
| `user_id` | NOT NULL，FK → profiles，`UNIQUE(user_id,id)` | Owner |
| `folder_id` | NULL 或同用户 folder | NULL 即 All Saves |
| `source_platform` | `chatgpt` / `deepseek` | 平台白名单 |
| `source_url` | HTTPS，≤2048，平台与 host 对应 | 只含 Adapter 允许的 path/query；无 credentials、fragment 或 tracking 参数 |
| `source_conversation_id` | NULL 或 1..512 | Adapter 能可靠取得时保存 |
| `source_message_id` | NULL 或 1..512 | 目标 assistant message 稳定 ID |
| `title` | trim/折叠空白后 1..240，单行且无控制字符 | Adapter 标题，缺失时由 prompt 纯文本派生 |
| `dedupe_key` | 64 位 hex | 数据库计算的 SHA-256 |
| `created_at` | 默认 `now()` | 行创建时间 |
| `saved_at` | 默认 `now()` | 用户列表与导出使用；调用方不能指定 |
| `updated_at` | 默认 `now()` | 文件夹归属变化时间 |

唯一约束 `(user_id,dedupe_key)` 是最终幂等裁决。folder 使用同用户复合外键并 `RESTRICT`，由受控删除流程先解除引用。

#### `messages`

| 字段 | 约束 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | Message ID |
| `user_id` | NOT NULL | 冗余 owner，用于 RLS 与同用户复合 FK |
| `conversation_id` | NOT NULL | `(user_id,conversation_id)` → conversation，级联删除 |
| `role` | `user` / `assistant` | Message role |
| `content_markdown` | trim 后非空，≤500,000 字符 | 唯一持久化正文 |
| `position` | smallint | MVP 只允许 0/1，且 role 必须与位置对应 |
| `created_at` | 默认 `now()` | 创建时间 |

`UNIQUE(conversation_id,position)` 防止重复位置。authenticated 客户端没有直接 INSERT/UPDATE/DELETE message 权限；写入只经 `save_capture_v1`，从而保证恰好两条。

#### `tags`

| 字段 | 约束 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | Tag ID |
| `user_id` | NOT NULL，FK → profiles，`UNIQUE(user_id,id)` | Owner |
| `name` | trim 后 1..80，单行且无控制字符 | 展示名 |
| `name_normalized` | 数据库生成的 `lower(trim(name))` | 用户内唯一 |
| `created_at`,`updated_at` | NOT NULL | 审计时间 |

唯一约束 `(user_id,name_normalized)`。

#### `conversation_tags`

| 字段 | 约束 | 说明 |
| --- | --- | --- |
| `user_id` | NOT NULL | Owner |
| `conversation_id` | NOT NULL | 与 user_id 一起引用 conversation，级联删除 |
| `tag_id` | NOT NULL | 与 user_id 一起引用 tag，级联删除 |
| `created_at` | 默认 `now()` | 关联时间 |

主键 `(user_id,conversation_id,tag_id)`；两条复合外键同时阻止跨用户关联。

### 5.4 输入限制

共享 Zod schema 与数据库 CHECK 应使用同一常量值：

| 输入 | 限制 |
| --- | --- |
| title | trim/折叠空白后 1..240 字符；单行、无控制字符 |
| canonical source URL | 1..2048 字符，HTTPS 且 host/platform 匹配 |
| source IDs | 可选；提供时 1..512 字符且无控制字符 |
| 每条 Markdown | trim 后非空，最多 500,000 字符 |
| 整个 JSON capture | 序列化后最多 1,100,000 字节 |
| folder/tag name | trim 后 1..80 字符；单行、无控制字符 |
| search query | trim 后 2..200 字符；空白代表退出搜索 |
| page size | 默认 30，最大 100 |

字符限制用于一致的 UX；总字节限制用于防止多字节正文绕过传输预算。Background 在序列化后检查字节数，数据库仍分别检查字段字符数。

### 5.5 删除与更新语义

- 删除 Auth user：级联 profile、folder、conversation、message、tag 和 join rows。
- 删除 conversation：级联 messages 与 conversation_tags；folder/tag 定义保留。
- 删除 tag：级联 conversation_tags；conversation 保留。
- 删除 folder：必须调用 `delete_folder_v1`。在同一事务中把直接子 folder 提升到被删 folder 的父级、把直接 conversation 的 folder 设为 NULL，再删除 folder。
- 如果提升子 folder 会违反目标层级的同名约束，整个删除回滚并返回 `folder_name_conflict`；UI 要求用户先重命名或移动冲突子目录，绝不自动改名。
- 修改 conversation：MVP 只允许 owner 修改 `folder_id`；title、messages 和 source metadata 不可变。

### 5.6 索引

除主键/唯一约束自动索引外，至少建立：

- `folders(user_id,parent_id,sort_order,name_normalized,id)`
- `conversations(user_id,saved_at DESC,id DESC)`
- `conversations(user_id,folder_id,saved_at DESC,id DESC)`
- `messages(user_id,conversation_id,position)`
- `tags(user_id,name_normalized,id)`
- `conversation_tags(user_id,tag_id,conversation_id)`
- conversation title 与 message Markdown 的 `simple` tsvector GIN 索引
- `lower(conversations.title)` 与 `lower(messages.content_markdown)` 的 `gin_trgm_ops` 索引

所有 RLS 的 `user_id` 过滤列必须有可用索引。上线前用代表性 explain 验证，而不是仅凭“建过索引”判断。

## 6. 数据库 API、权限与 RLS

### 6.1 API 分工

| 操作 | 入口 |
| --- | --- |
| 保存单次问答 | `save_capture_v1` RPC |
| 删除 folder 并提升子项 | `delete_folder_v1` RPC |
| 组合搜索、相关性与 cursor | `search_conversations_v1` RPC |
| 列表、详情、folder/tag CRUD、关联、conversation 移动与删除 | Supabase Data API，在 RLS 下执行 |

RPC 名称带版本号，因为它们是 Extension/Web 与数据库之间的公开契约；内部 trigger helper 不需要版本化。

### 6.2 `save_capture_v1`

概念签名：

```text
save_capture_v1(
  source_platform,
  source_url,
  source_conversation_id?,
  source_message_id?,
  title,
  user_markdown,
  assistant_markdown
) -> { conversation_id, outcome: "created" | "duplicate" }
```

处理步骤：

1. 读取并验证 `auth.uid()`，不接受 `user_id` 参数。
2. 重做非空、长度、平台和 canonical host 校验；错误只返回稳定错误码，不回显正文。
3. 计算 dedupe key：
   - 有可靠 `source_message_id`：哈希版本号、platform、source conversation ID 和 source message ID。
   - 无可靠 message ID：哈希版本号、platform、canonical URL、可选 conversation ID、user Markdown 和 assistant Markdown。
   - 使用带版本号的 `jsonb_build_array(...)::text` 作为哈希输入，避免简单分隔符造成歧义；SHA-256 只由数据库 `pgcrypto` 计算，客户端不提交或预计算 `dedupe_key`。
4. 尝试插入 conversation；`(user_id,dedupe_key)` 冲突时读取已有 ID 并返回 `duplicate`。
5. 仅当 conversation 是新建时插入两条固定 role/position message。
6. PostgreSQL function 调用天然处于一个事务；任何异常回滚全部写入。

函数使用 `SECURITY DEFINER SET search_path = ''`，所有对象写全 schema。理由是 authenticated 角色不应获得直接插入 conversation/message 的权限。函数必须显式校验 `auth.uid()`，从 `public` 和 `anon` revoke EXECUTE，仅 grant 给 `authenticated`。

### 6.3 `delete_folder_v1`

函数输入只有 folder ID。它使用相同的 hardened `SECURITY DEFINER` 规则，并执行：

1. 要求 authenticated user，获取该用户的 hierarchy advisory lock。
2. `SELECT ... FOR UPDATE` 获取 owned folder；缺失和非 owned 使用相同 not-found 错误。
3. 把直接 child 的 parent 更新为旧 parent；唯一约束冲突映射为稳定冲突错误。
4. 把直接 conversation 的 folder_id 设为 NULL。
5. 删除 owned folder，返回删除成功。

authenticated 没有 folder 表的直接 DELETE grant，以免绕过提升语义。

### 6.4 `search_conversations_v1`

该函数优先使用默认 `SECURITY INVOKER`，让表 RLS 始终生效。它不接受 user ID，查询同时显式添加 `user_id = auth.uid()` 以帮助 planner。

输入：normalized query、可选 folder ID、可选 tag ID、可选 `(rank,saved_at,id)` cursor、limit。输出只含 conversation summary、匹配 rank 和下一页所需字段，不返回完整消息正文。

匹配策略：

- `websearch_to_tsquery('simple', query)` 对英文和有空格 token 的文本做 FTS。
- 参数化的 case-insensitive literal contains 覆盖中文片段和代码片段；`pg_trgm` GIN 索引加速可索引模式。
- 每条 conversation 用 EXISTS/聚合保证只出现一次。
- title match 权重大于 body-only match；相同 rank 按 `saved_at DESC,id DESC`。
- 任何动态值均为函数参数，不拼 SQL 字符串。

### 6.5 grant 与 policy 矩阵

`anon` 对所有用户表无 CRUD 权限，对三个公开 RPC 无 EXECUTE。`authenticated` 最小权限如下：

| 对象 | SELECT | INSERT | UPDATE | DELETE | 备注 |
| --- | --- | --- | --- | --- | --- |
| profiles | own | 否 | 否 | 否 | 由 Auth trigger 管理 |
| folders | own | own | owned columns | 否 | 删除只走 RPC |
| conversations | own | 否 | folder only | own | 保存只走 RPC |
| messages | own | 否 | 否 | 否 | 随 conversation 级联 |
| tags | own | own | name only | own | 约束保护 normalized unique |
| conversation_tags | own | own | 否 | own | 复合 FK 保护双方 owner |

每个 policy 明确 `TO authenticated`，并使用 `(select auth.uid()) = user_id`。INSERT 使用 `WITH CHECK`；UPDATE 同时使用 `USING` 与 `WITH CHECK`。所有公开 schema 新对象默认 revoke，再逐个 grant，避免未来 migration 意外扩大 Data API 表面。

## 7. Extension 设计

### 7.1 运行时分层

```text
Injected Save UI
      │ click / state
Content Runtime（唯一 DOM lifecycle owner）
      │
SiteAdapter Registry ──► ChatGPTAdapter / DeepSeekAdapter
      │ Extracted CaptureDraft
Shared capture schema
      │ runtime message
Background handler
      ├── sender + schema validation
      ├── session assurance
      └── Supabase save_capture_v1
```

职责边界：

- Adapter：URL 匹配、目标发现、prompt 配对、streaming 判断、metadata 和 DOM extraction。
- Markdown converter：克隆 DOM、移除噪声、把允许语义转成 Markdown；不包含站点选择器。
- Content runtime：Adapter 选择、唯一 observer/route guard、目标注册、Plasmo anchor 与状态机。
- Save UI：展示状态和发起一次 action；不直接解析复杂 DOM、不联网。
- Background：会话、权限消息、Supabase client、RPC 与错误映射；不访问页面 DOM。

### 7.2 Adapter 合同

设计级接口：

```ts
type AdapterTarget = {
  responseElement: HTMLElement
  mountPoint: HTMLElement
  localKey: string
}

interface SiteAdapter {
  readonly platform: "chatgpt" | "deepseek"
  matches(url: URL): boolean
  findTargets(root: ParentNode): AdapterTarget[]
  isStreaming(target: AdapterTarget): boolean
  extract(target: AdapterTarget, pageUrl: URL): CaptureDraft
  healthCheck(document: Document): AdapterDiagnostic[]
}
```

`CaptureDraft` 必须包含 platform、canonical URL、可选 source IDs、title 和固定 tuple `[user,assistant]`。Adapter 不拥有网络、Auth、数据库、toast 或 observer。

新增平台的正常改动范围应是：一个 Adapter、sanitized fixtures/tests、一条 registry 注册和 manifest host permission；核心保存逻辑不修改。显式 registry 比 bundler 自动扫描更容易审计。

### 7.3 Selector 与验证策略

每个 Adapter 为每项关键能力记录：primary selector、fallback selector、validation。优先顺序：

1. 官方稳定 `data-*` / message ID。
2. `aria-*`、role、可读 label。
3. 语义元素与同一 turn 内的相对结构。
4. 多个信号的组合。
5. 稳定性已由 fixture 证明的 class fallback。

“selector 命中”不等于“目标有效”。Validation 至少确认：元素连接在当前 document、属于当前 conversation root、角色匹配、正文非空、目标与 mount point 一一对应。模糊结果 fail closed。

不得凭公开首页或旧博客猜测登录后 DOM。实施每个 Adapter 前必须获得当前站点的无隐私 fixture，并完成一次真实页面 smoke test。

### 7.4 DOM 生命周期

- 默认由 Plasmo CSUI 的 `getInlineAnchorList`/watch 生命周期拥有唯一的 document 级目标发现 observer；content runtime 不再叠加第二个永久 discovery observer，Adapter 也不创建永久 observer。
- Plasmo 触发的 mutation 批次应增量发现目标；若框架回调仍需聚合，使用 microtask 或短 debounce，不能对每个 mutation 同步全树扫描。
- 使用 WeakMap/connected check 跟踪 mount point 与 target；Plasmo Shadow DOM 隔离样式。
- 监听 `popstate`/`hashchange`，并在 mutation scan 或单一 route guard 中比较 `location.href`，覆盖 `pushState` 导航。
- URL/Adapter 变化时先清理旧 listeners、timers、target state 和 injected roots，再初始化新生命周期。
- Streaming 状态优先依赖平台明确的停止/生成信号；若必须观察正文变化，只能为当前 target 建立短生命周期 observer，并在完成、替换或卸载时断开。点击时必须重新检查，避免竞态。

### 7.5 Markdown 转换

转换步骤：

1. 克隆 prompt/response 内容根，绝不修改站点 DOM。
2. 移除 script、style、button、textarea、隐藏/aria-hidden 控件，以及 Adapter 标注的 copy/feedback/save 噪声。
3. 对 code/pre、table、list、blockquote、link 和常见 emphasis 使用通用 Turndown + GFM 规则；link destination 只保留明确允许的 HTTP(S)、mailto 及经过 Adapter 验证的安全相对引用，其他协议只保留可读文字。
4. 对可验证的公式源（例如语义 annotation 中的 TeX）使用自定义规则保留 `$...$`/`$$...$$`；无法验证时降级为可读文本。
5. 规范化结构性空行和结尾换行，但不改写 code block 内部空白。
6. 校验非空与上限，返回纯数据 `CaptureDraft`。

MVP 不保存 `content_html`，也不使用站点的“复制”按钮或剪贴板作为主要数据源，避免权限、用户手势和格式差异。

### 7.6 消息与 UI 状态

消息 handler 必须是有限集合：`auth-status`、`sign-in`、`sign-out`、`save-capture`。不实现通用 fetch proxy。调用来源矩阵固定如下：

| Handler | 允许来源 | 拒绝来源 |
| --- | --- | --- |
| `auth-status` | Extension popup | content script、网页或外部 extension |
| `sign-in` | Extension popup | content script、网页或外部 extension |
| `sign-out` | Extension popup | content script、网页或外部 extension |
| `save-capture` | 两个支持 host 的 top-level content script | popup、iframe、unsupported tab、网页或外部 extension |

Manifest 不声明 `externally_connectable`。Background 必须按 handler 验证 `sender.id`、`sender.url`、`sender.tab` 与 frame；不能只因消息结构合法就执行。

`save-capture` background handler：

1. 校验消息来自本扩展 content script 的 top-level supported tab。
2. 校验 sender URL、payload platform、payload source URL 三者一致。
3. 重新执行共享 schema 和总字节限制。
4. 恢复/刷新独立 Extension session；失败返回 `AUTH_REQUIRED`/`AUTH_EXPIRED`。
5. 调用 `save_capture_v1`，只返回 conversation ID 与 created/duplicate outcome。

每个目标使用有限状态机：

```text
unavailable(streaming/invalid) ──► idle ──► saving
                                      ▲        ├──► saved
                                      │        ├──► duplicate
                                      └ error ◄┘
```

`saving` 禁止再次提交。数据库唯一约束而非这个 UI 锁负责并发最终正确性。

### 7.7 Manifest 权限

生产 manifest 的页面范围只包含：

- `https://chatgpt.com/*`
- `https://chat.deepseek.com/*`

Background 跨域范围只包含构建时 Supabase project HTTPS origin。普通权限只需要 `storage`；MVP 不申请 `<all_urls>`、`tabs`、`cookies`、`identity`、`webRequest`、`scripting`、`clipboardRead` 或 `unlimitedStorage`。

Background 初始化时把 `chrome.storage.local` access level 设为 trusted contexts，阻止 content scripts 读取 session。若目标 Chrome 版本不支持所需安全 API，构建应提高 minimum Chrome version，而不是默默退回共享 localStorage。

## 8. 认证设计

### 8.1 Web

- 使用 Supabase 当前官方 SSR client，在 cookie 中维护 Web 自己的 PKCE session。
- 使用当前 Next.js 约定的 request proxy/middleware 刷新过期 token。
- 保护路由和 Server Action 使用远端验证后的 user，不仅信任本地 session payload。
- 注册、email confirmation callback、登录、登出、forgot/reset password 全部由 Web 提供。
- Supabase redirect allowlist 明确包含本地与生产 callback/reset URL。
- Web server 也只使用 publishable key；MVP 不需要 privileged key。

### 8.2 Extension

- 使用 `@supabase/supabase-js` 和基于 `chrome.storage.local` 的最小 Storage adapter。
- Supabase client 只在 background 创建；popup/content 不创建第二个 client。
- 每个 background 请求恢复 session，并调用官方刷新/用户验证 API；不自行解析 JWT 来决定有效性。
- worker 被 Chrome 回收不是错误；下一次消息必须从 storage 恢复。
- logout 只清除 Extension session；Web session 独立。

## 9. Dashboard 设计

### 9.1 路由与数据访问

推荐路由：

```text
/(auth)/sign-in
/(auth)/sign-up
/(auth)/forgot-password
/(auth)/reset-password
/auth/callback
/(dashboard)                         All Saves + query filters
/(dashboard)/conversations/[id]     Detail viewer
```

- Server Components 获取初始 list/detail/folder/tag 数据。
- Server Actions 执行 rename/move/delete/tag mutations，每次做 Zod 校验与 auth user 验证，再让 RLS 最终授权。
- filter/search/cursor 存在 URL search params，便于刷新和返回；参数非法时规范化而不是传入数据库。
- Client Components 只负责交互状态，不维护另一份长期 server cache。

### 9.2 布局与行为

```text
Desktop: Sidebar | Conversation List | 选中后 Detail/独立详情
Narrow:  Sidebar drawer → List → Detail route
```

Sidebar：All Saves、folder tree、tags。主区：search、当前 filter、固定 30 条 cursor page、cards。详情：title、source、saved time、folder/tags、messages、source link、export/delete。

MVP folder 筛选只含“直接归属”，不隐含递归 descendant；这个语义简单、可预测。Folder 通过选择框 reparent/move，不实现拖拽。

### 9.3 Markdown 安全

- 使用 AST 驱动的 Markdown renderer，启用 GFM 和静态 code highlighting；超出实现中记录阈值的单个代码块降级为未高亮的纯 code 渲染，避免高亮器阻塞页面。
- 不启用 raw HTML parser（例如不加入 `rehype-raw`）。
- 自定义链接组件只允许明确协议；外部链接使用 `target=_blank` 与 `rel=noopener noreferrer`。
- 不通过 `dangerouslySetInnerHTML` 渲染消息正文。
- 代码高亮器只处理文本 token，不执行代码。

## 10. 搜索设计

输入先 trim。空字符串退出搜索；1 个字符不发查询并提示至少 2 个字符；上限 200。客户端 debounce 只优化请求频率，数据库校验仍是权威。

搜索 scope：title + 两条 message Markdown；可与 folder/tag 取交集。结果只返回 summary，不生成带 HTML 的 highlight。这样避免新的 XSS 面，也避免把完整正文带到列表。

Cursor 由当前查询、filter、rank、saved_at、id 组成并编码为 opaque string。服务端解码后再次校验；查询/filter 变化立即丢弃旧 cursor。在数据不变且查询/filter 不变时，keyset 条件保证无重复/遗漏。写入并发时允许新记录出现在刷新后的第一页，不承诺跨变更快照隔离。

## 11. Markdown 导出

Export 是纯函数加浏览器下载适配器：

```text
# <title>

Source: <platform>
URL: <canonical URL>
Saved: <ISO 8601>

## User

<stored markdown verbatim>

## Assistant

<stored markdown verbatim>
```

- formatter 不经 HTML，不重新解析 message Markdown。
- 每段之间使用固定空行，文件以单个 newline 结束。
- filename 对 `/\\:*?"<>|`、控制字符、`.`/`..`、Windows reserved name 和过长内容做替换/截断；空结果使用 `chatstash-export.md`。
- 只做单篇即时 Blob 下载，不使用 Supabase Storage。

## 12. 错误、日志与可观测性

共享错误码至少包括：

| 类别 | 错误码示例 | UI 行为 |
| --- | --- | --- |
| Auth | `AUTH_REQUIRED`, `AUTH_EXPIRED`, `INVALID_CREDENTIALS` | 打开/引导登录；不自动无限重试 |
| Adapter | `UNSUPPORTED_PAGE`, `TARGET_NOT_FOUND`, `PAIR_NOT_FOUND`, `RESPONSE_STREAMING` | 当前目标 unavailable 或提示页面结构变化 |
| Validation | `INVALID_CAPTURE`, `PAYLOAD_TOO_LARGE`, `INVALID_SOURCE_URL` | 不发送/不持久化，显示可理解限制 |
| Conflict | `DUPLICATE_CAPTURE`, `FOLDER_NAME_CONFLICT`, `TAG_NAME_CONFLICT`, `FOLDER_CYCLE` | 显示已保存或要求用户修正 |
| Transport | `NETWORK_ERROR`, `SERVICE_UNAVAILABLE` | 保留状态并允许手动 retry |
| Data | `NOT_FOUND`, `SAVE_FAILED`, `SEARCH_FAILED` | not-found 或 retry，不伪装成 empty |

所有日志以 `[ChatStash]` 开头，并记录 operation、platform、error code、adapter capability、conversation UUID（保存后）和耗时。禁止记录：password、access/refresh token、publishable key 以外的密钥、URL credentials/fragment/非白名单 query、完整 prompt/response、DOM/HTML fixture、Auth header。生产环境不默认上传遥测。

## 13. 依赖基线

实现时选择相互兼容的当前稳定版本，并提交 lockfile；不得仅写 `latest` 后不锁定。

| Package / 工具 | 使用位置 | 目的 | 为什么需要 |
| --- | --- | --- | --- |
| `zod` | shared、两端入口 | 单一 runtime contract | TypeScript 类型本身不能校验不可信输入 |
| `@supabase/supabase-js` | Web/Extension | Auth、Data API、RPC | 官方客户端 |
| `@supabase/ssr` | Web | App Router cookie session | 避免自建 SSR token 刷新 |
| `@plasmohq/messaging` | Extension | content/popup/background 单次消息 | 与 Plasmo 生命周期集成；Zod 仍是权威校验 |
| `turndown` | adapters | DOM → Markdown | 自行覆盖全部 HTML 语义成本过高 |
| `turndown-plugin-gfm` | adapters | tables、strikethrough、task list | 满足 GFM 保存范围 |
| `react-markdown` | Web | 安全 AST 渲染 | 默认不执行 raw HTML |
| `remark-gfm` | Web | GFM display | tables/task list 等 |
| `rehype-highlight` + `highlight.js` | Web | 静态代码高亮 | 不执行用户代码 |
| shadcn/ui 按需组件 | Web | 可访问基础 UI | 只生成实际使用组件，避免完整 UI framework |
| Vitest + Testing Library + jsdom | packages/apps | 单元与 DOM fixture 测试 | 快速、TypeScript 友好 |
| Supabase CLI + pgTAP | database | migration/RLS/RPC 验证 | 在真实 PostgreSQL 权限模型上测试 |

不引入 axios（原生 fetch/官方 SDK 足够）、Redux（状态规模不足）、DOMPurify（MVP 不解析 raw HTML）、Turborepo、ORM、独立 API framework、搜索 SDK 或向量 SDK。

## 14. 测试策略与验收层次

### 14.1 数据库

- migration 从空库可重复执行，reset 后 schema 一致。
- 每表 owner 正常 CRUD 与 user A/user B 交叉读写。
- 跨用户 folder/conversation/tag 关系全部失败。
- folder 自环、后代环、并发 reparent、删除提升及重名回滚。
- save created/duplicate、无 session、非法 role/content/source、异常回滚、user 间相同 dedupe。
- cascade 行为与 profile backfill。
- 英文/中文 title/body 搜索、filter、rank、cursor 和 injection-like 输入。

### 14.2 Adapter 与 Markdown

- 每个平台至少有 primary、fallback、streaming、invalid 四类 sanitized fixture。
- 合同测试覆盖 match、targets、pair、metadata、streaming、Markdown、噪声排除和重复 mount。
- code whitespace、table、link、nested list、公式 source 与恶意 HTML 文本 golden tests。
- fixture 必须来自无隐私合成对话；更新 selector 必须同时更新失败原因和 fixture。

### 14.3 Web

- auth Server Action/route protection、expired session、open redirect 防护。
- list/detail cursor、not-found indistinguishability、delete reconciliation。
- raw HTML、javascript URL、event handler Markdown 不执行。
- folder/tag validation/filter；搜索 empty 与 error 分开；export golden string/filename。

### 14.4 Extension

- custom storage adapter、worker re-instantiation、session state。
- forged sender/unsupported URL/malformed/oversized payload 被拒绝。
- RPC created/duplicate/error 到 UI state 的映射。
- unpacked build 权限清单审计和两个真实平台的人工 smoke test。

### 14.5 阶段门槛

每个 `tasks.md` 阶段必须先通过本阶段自动测试与人工验收，才能勾选并进入下一阶段。最终至少运行：install with frozen lockfile、lint、typecheck、unit tests、database reset/tests/lint、Web production build、Extension production build、OpenSpec strict validation。

## 15. 主要风险与缓解

| 风险 | 概率/影响 | 缓解 | 触发升级条件 |
| --- | --- | --- | --- |
| AI 网站 DOM 改版 | 高 / 高 | semantic selectors、fallback+validation、fixture contract、fail closed、统一诊断 | fixture/live smoke 同时失败时只修对应 Adapter |
| MV3 worker 与 Auth refresh 不稳定 | 中 / 高 | background-only client、Chrome storage adapter、每次调用恢复/验证、重启测试 | 官方 SDK 在 worker 中无法可靠恢复时再评估 Web-assisted login 或 identity flow |
| RLS/跨表所有权遗漏 | 中 / 极高 | explicit grants、RLS、复合 FK、RPC ownership checks、双用户 pgTAP | 任一跨用户测试可观察或改变数据即阻断发布 |
| Markdown fidelity 与 XSS | 中 / 高 | cloned DOM、allowlisted conversion、Markdown-only、no raw HTML renderer、恶意 fixture | 需要保留无法表达结构时先扩展 Markdown 规则，不先启用 HTML fallback |
| 中英文搜索效果/索引体积 | 中 / 中 | FTS + trigram、query limits、EXPLAIN、真实样本评估 | 数据量/延迟超过 MVP 指标后再评估 PGroonga/专用搜索，不提前引入 |

## 16. 被否决的替代方案

### Next.js API Route 作为 Extension 唯一后端

它会复制 Supabase JWT 验证、CORS、部署和错误层；MVP 没有需要隐藏的第三方密钥或复杂业务编排。数据库 RPC + RLS 更短。未来若出现计费、速率限制、服务端密钥或跨服务 workflow，再引入受控 API。

### Extension 直接进行两次表 INSERT

conversation 成功而 message 失败会产生半成品；重试和并发也更难正确。单事务 RPC 是必要复杂度。

### content script 直接持有 Supabase session

它扩大不可信页面上下文的暴露面，并使 CORS、worker、popup 各自产生 client。background 集中边界更清楚。

### 保存 HTML 作为 fallback

这会引入双事实源、显著扩大 XSS 审计面，也无法保证站点 CSS 下的可移植性。MVP 选择可读 Markdown 降级。

### 一开始保存完整来源会话

它要求处理分支、regenerate、消息增删、同步游标和来源更新，远超“回复旁保存”的首版价值。数据表支持未来多消息，但当前契约保持两条。

### ltree 存 folder path

Folder 移动会更新整棵子树，路径 label 与 UUID 转换增加维护成本。MVP 用 adjacency list + 防环 trigger；读取时由已隔离的 flat list 在客户端构树。

## 17. 实施与演进

按 `tasks.md` 严格完成一个阶段后停下验收。数据库 schema/安全先于真实 Adapter；Web auth 先提供可创建账号的路径；DeepSeek 和 ChatGPT 分别独立验收；Dashboard 先读/详情，再组织、搜索、导出。

未来演进不需要当前预建抽象：

- 多轮快照：放宽 message count/role-position constraint，新增 capture mode migration。
- 更多平台：新增 Adapter、host permission、fixtures、registry entry。
- HTML fallback：必须作为单独 OpenSpec change 重新做存储、sanitization 和 CSP 威胁模型。
- 专用后端/搜索：以可测量的安全或性能触发条件启动新 change。

## 18. 实施时必须取得的外部证据

以下内容无法仅凭 README 静态决定，不能由实现模型猜测：

1. 实施当天 ChatGPT 与 DeepSeek 登录后页面的 sanitized DOM fixtures。
2. 两个平台 streaming 开始/结束的当前可验证信号。
3. 实际 Supabase project origin、publishable key 和 Auth redirect allowlist。
4. 当时稳定版本的 Next.js、Plasmo、Supabase SDK API 与兼容 Node 版本。

这些不是产品未决策，而是会随外部平台变化的实施证据。若缺失，相关阶段应明确停止并报告所需材料，而不是创造 selector 或第三方 API。

## 19. 参考基线

- [OpenSpec Getting Started](https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md)
- [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome extension messaging security](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Chrome cross-origin requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase Full Text Search](https://supabase.com/docs/guides/database/full-text-search)
