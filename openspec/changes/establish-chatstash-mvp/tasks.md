# ChatStash MVP 实现任务

## 执行协议（必须遵守）

- 每次实现会话只处理一个 `## 阶段`；不要提前实现后续阶段。
- 开始阶段前先读取 `proposal.md`、`design.md`、本文件以及该阶段关联的 capability spec。
- 开始前运行 `git status --short`，保留所有已有用户修改；只能触碰该阶段“文件范围”中的路径。若必须越界，先停止并解释原因。
- 所有新增依赖先说明 package、purpose、why needed；选择相互兼容的稳定版本并提交 lockfile。
- 实现必须完整可运行，不得以 TODO、伪代码、空 handler、`any` 或永久 mock 代替任务。
- 一个 task 只有在其代码、自动测试和该阶段验收都通过后才能标为 `[x]`。
- 阶段结束时输出：完成项、改动文件、运行命令与结果、人工验证结果、风险/未决项；然后停止。
- 需要当前 ChatGPT/DeepSeek DOM 或真实 Supabase 配置但仓库没有时，必须阻塞并索要证据，不得猜 selector、host 或 key。

## 阶段 0 — 规划基线（当前文档阶段）

**Goal**：把 README 评审、可验收规范、技术设计和实施清单固定为后续唯一执行基线。

**关联 capability**：全部。

**文件范围**：

```text
docs/readme-design-review.md
openspec/**
```

- [x] 0.1 逐段评审 README，记录必须保留的原则、关键歧义、MVP 简化项与架构决策摘要。
- [x] 0.2 初始化 OpenSpec `spec-driven` 配置与 `establish-chatstash-mvp` change metadata。
- [x] 0.3 为 identity、capture、adapters、library、organization、search、export 编写 SHALL/Scenario delta specs。
- [x] 0.4 编写含信任边界、schema、RPC、RLS、Extension、Web、搜索、导出和测试策略的设计文档。
- [x] 0.5 将实现拆成有顺序、文件范围和验收门槛的阶段。

**自动验证**：

```bash
openspec status --change establish-chatstash-mvp
openspec validate establish-chatstash-mvp --strict
```

**验收门槛**：所有 capability 都在 proposal 中声明并存在对应 spec；所有 requirement 至少一个 scenario；OpenSpec strict validation 通过；没有业务代码变更。

---

## 阶段 1 — Workspace 与质量门禁

**Goal**：只创建可安装、可构建、可测试的 monorepo 骨架，不实现业务 UI 或数据库实体。

**关联设计**：§4、§13、§14。

**文件范围**：

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
.gitignore
.env.example
.npmrc
tsconfig.base.json
eslint.config.*
prettier.config.*
apps/extension/package.json
apps/extension/tsconfig.json
apps/extension/.env.example
apps/web/package.json
apps/web/tsconfig.json
apps/web/.env.example
packages/shared/package.json
packages/shared/tsconfig.json
packages/shared/src/index.ts
packages/shared/test/**
packages/adapters/package.json
packages/adapters/tsconfig.json
packages/adapters/src/index.ts
packages/adapters/test/**
```

- [x] 1.1 确认当前稳定且相互兼容的 Node、pnpm、Next.js、React、Plasmo、TypeScript 和测试工具版本；写入 `engines`/`packageManager`，不使用未锁定的 `latest`。
- [x] 1.2 建立 pnpm workspace 根脚本：`dev`、`build`、`lint`、`typecheck`、`test`、`format:check`；保持 `strict: true`，避免 packages 间源码深路径导入。
- [x] 1.3 创建四个 workspace 的最小入口和 project references/paths，使空骨架可以 typecheck/test；不要生成 Dashboard 页面、Adapter 或 Supabase client。
- [x] 1.4 创建分应用 `.env.example`：只列 Supabase URL、publishable key、Web URL 等公开配置名，不放真实值或 privileged key。
- [x] 1.5 配置 lint/format/test，增加一个 shared smoke test 和一个 adapters smoke test，证明 runner 能执行两个 package。

**自动验证**：

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
```

**人工验收**：检查 lockfile 已提交；`rg` 不存在 `service_role`/`secret key` 实值；依赖方向符合 design；无无关 UI/业务实现。

**停止条件**：五个命令全部成功后勾选 1.1–1.5，汇报并停止。

---

## 阶段 2 — 数据库 schema、RLS 与原子 RPC

**Goal**：建立可从空库迁移、可由双用户测试证明隔离的数据层；此阶段不连接 Web/Extension。

**关联 capability**：`identity-and-access`、`conversation-capture`、`content-organization`、`conversation-search`。

**关联设计**：§5、§6、§10。

**文件范围**：

```text
supabase/config.toml
supabase/migrations/**
supabase/tests/database/**
supabase/seed.sql
package.json                 # 仅数据库脚本
packages/shared/src/database.types.ts  # 仅通过 CLI 生成
```

- [x] 2.1 初始化 Supabase local config；按职责拆 migration（extensions/enums、tables/constraints/indexes、triggers、RLS/grants、RPC/search），确保按文件名顺序从空库执行。
- [x] 2.2 创建六表 schema、timestamps、长度/check/role-position 约束、同用户复合外键、unique/index 和 `auth.users → profiles` trigger；migration 回填已有 Auth 用户。
- [x] 2.3 实现 folder 层级验证和 `delete_folder_v1`，包含 transaction advisory lock、防自环/后代环、子项提升、conversation 置 NULL、冲突整单回滚。
- [x] 2.4 实现 hardened `save_capture_v1`：auth ownership、canonical host/limit 重检、数据库唯一计算的版本化 SHA-256 dedupe、原子两消息插入、并发 duplicate 返回已有 ID；pgTAP 固定 hash vectors，客户端不提交 dedupe key。
- [x] 2.5 建立 explicit default revoke、逐对象 grants 和全部 RLS policy；authenticated 不得直接插入 conversation/message 或直接删除 folder。
- [x] 2.6 实现 `search_conversations_v1`、FTS/trigram 索引、rank、folder/tag filter 与 deterministic cursor；函数不拼接动态 SQL。
- [x] 2.7 编写 pgTAP/SQL tests：user A/B CRUD 与越权、跨用户 FK、RLS、RPC unauthorized/created/duplicate/concurrent、回滚、cascade、folder cycle/delete conflict、英文/中文 search、rank/cursor/filter。
- [x] 2.8 从 reset 后数据库生成 TypeScript types，禁止手写猜测生成类型。

**自动验证**：

```bash
supabase start
supabase db reset
supabase db lint --level warning
supabase test db
supabase gen types typescript --local > /tmp/chatstash-database.types.ts
diff -u packages/shared/src/database.types.ts /tmp/chatstash-database.types.ts
```

最后一个生成命令的写文件方式由实现环境选择，但不得用手工内容替代。若 Docker/Supabase CLI 缺失，安装或启动属于阻塞条件，需要明确报告。

**人工验收**：逐表检查 RLS enabled、anon 无用户数据权限、函数 EXECUTE grant 正确、`save_capture_v1` 无 `user_id` 入参、所有 `SECURITY DEFINER` 都设置空 search_path 并使用全限定对象名。

**停止条件**：reset、lint、全部数据库测试和 generated-types diff 成功后汇报并停止。

---

## 阶段 3 — 共享契约与纯 Markdown 核心

**Goal**：提供不依赖 UI/框架的唯一 runtime contract、错误模型、限制、URL canonicalization 和 DOM-to-Markdown 纯逻辑。

**关联 capability**：`conversation-capture`、`site-adapters`、`markdown-export`。

**文件范围**：

```text
packages/shared/src/contracts/**
packages/shared/src/errors.ts
packages/shared/src/limits.ts
packages/shared/src/platform.ts
packages/shared/src/index.ts
packages/shared/test/**
packages/adapters/src/dom/**
packages/adapters/src/markdown/**
packages/adapters/src/types.ts
packages/adapters/src/index.ts
packages/adapters/test/markdown/**
packages/adapters/fixtures/common/**
pnpm-lock.yaml
```

- [x] 3.1 定义 `SourcePlatform`、`CaptureDraft`（固定两消息 tuple）、background request/response、stable error codes、list/search cursor contracts；所有不可信入口有 Zod schema。
- [x] 3.2 实现 design §5.4 limits 和 platform-aware canonical URL；拒绝 HTTP、unsupported host、credentials、fragment 和非白名单 query，不让 caller 自行声明任意 host。
- [x] 3.3 明确 CaptureDraft 不接受 `user_id`、`dedupe_key`、数据库 ID 或保存时间等服务端字段；测试 unknown fields、Unicode、identifier fallback 和 field/byte 边界。
- [x] 3.4 引入并封装 Turndown/GFM，克隆 DOM、移除噪声、实现 code/table/list/link/formula 等规则；对无法安全转换内容降级为文本。
- [x] 3.5 编写 golden tests：GFM、nested elements、code whitespace、formula annotation、unsafe HTML、noise controls、empty/oversized result；fixture 全部合成且无隐私。

**自动验证**：

```bash
corepack pnpm --filter @chatstash/shared test
corepack pnpm --filter @chatstash/adapters test
corepack pnpm typecheck
corepack pnpm lint
```

**人工验收**：`packages/shared` 不依赖 DOM/React/Next/Plasmo/Supabase runtime；转换结果不含 script/style/button；没有 raw HTML 持久化字段。

**停止条件**：golden tests 与全局门禁通过后汇报并停止。

---

## 阶段 4 — Web 认证纵切

**Goal**：让用户可以在 Web 注册、确认、登录、恢复密码和退出，并能进入一个受保护的空 Dashboard shell。

**关联 capability**：`identity-and-access`。

**文件范围**：

```text
apps/web/app/(auth)/**
apps/web/app/(dashboard)/**          # 仅空 shell/保护路由
apps/web/app/auth/callback/**
apps/web/components/auth/**
apps/web/lib/supabase/**
apps/web/lib/validation/auth.ts
apps/web/proxy.ts 或当前 Next.js 等价文件
apps/web/test/auth/**
apps/web/package.json
apps/web/.env.example
pnpm-lock.yaml
```

- [x] 4.1 根据实施时官方 Next.js/Supabase SSR 文档创建 browser/server clients 和 cookie refresh proxy；禁止使用已弃用 helper 或 privileged key。
- [x] 4.2 实现 email/password sign-up、sign-in、sign-out、confirmation callback、forgot/reset password；callback 的 next 参数只能跳转站内安全路径。
- [x] 4.3 保护 Dashboard shell，远端验证用户；unauthenticated/expired session 不渲染受保护内容。
- [x] 4.4 实现 loading/error/success 状态和不泄露账户存在性的 auth 文案。
- [x] 4.5 测试 validation、safe redirect、callback error、route protection 和 sign-out；使用 mock boundary，不伪造 Supabase SDK 不存在的 API。

**自动验证**：

```bash
corepack pnpm --filter @chatstash/web lint
corepack pnpm --filter @chatstash/web typecheck
corepack pnpm --filter @chatstash/web test
corepack pnpm --filter @chatstash/web build
```

**人工验收**：使用本地 Supabase 新建并确认用户；刷新后 session 存在；重置密码可完成；退出后受保护 route 回登录；浏览器 bundle 无 secret/service-role key。

**停止条件**：自动测试和上述真实本地 Auth 流程通过后汇报并停止。

---

## 阶段 5 — Extension 后台认证与保存纵切（无真实站点）

**Goal**：先证明 MV3 worker 的独立 session、严格消息边界和真实 `save_capture_v1` 调用，避免把 Auth 风险拖到 Adapter 后解决。

**关联 capability**：`identity-and-access`、`conversation-capture`。

**文件范围**：

```text
apps/extension/background/**
apps/extension/src/auth/**
apps/extension/src/messaging/**
apps/extension/src/capture/**
apps/extension/src/ui/popup/**
apps/extension/popup.tsx
apps/extension/test/auth/**
apps/extension/test/background/**
apps/extension/package.json
apps/extension/.env.example
pnpm-lock.yaml
```

- [x] 5.1 在 background 创建唯一 Supabase client 和 `chrome.storage.local` adapter；将 storage access level 限制为 trusted contexts，测试 worker 重建后 session 恢复。
- [x] 5.2 实现 popup 的 email/password sign-in、auth status、sign-out 和 Web sign-up/recovery link；密码不持久化、不记录。
- [x] 5.3 建立有限 typed handlers `auth-status/sign-in/sign-out/save-capture`；每个 handler 用共享 schema 校验，并落实 design §7.6 sender matrix；不建通用 fetch proxy，不声明 `externally_connectable`。
- [x] 5.4 `save-capture` 校验 sender/top frame/supported tab、platform/source URL 一致性、field/byte limits 和 session，再调用 RPC 并映射 created/duplicate/stable errors。
- [x] 5.5 通过测试-only mock content caller 或固定合成 payload 打通真实本地 Supabase 保存；测试 unauthorized、forged sender、oversized、duplicate、network/RPC errors。

**自动验证**：

```bash
corepack pnpm --filter @chatstash/extension lint
corepack pnpm --filter @chatstash/extension typecheck
corepack pnpm --filter @chatstash/extension test
corepack pnpm --filter @chatstash/extension build
```

**人工验收**：加载 unpacked build；popup 登录/刷新/worker idle 后仍可恢复；logout 不影响 Web session；合成保存只生成一个 conversation + 两 messages；content context 不能读 session token。

**停止条件**：真实本地 RPC 纵切和权限检查通过后汇报并停止。

---

## 阶段 6 — Extension Content Runtime 与合成 Adapter

**Goal**：使用 repository-owned synthetic page 证明 Adapter contract、唯一 DOM lifecycle、注入 UI 状态机和 background 消息端到端协作。

**关联 capability**：`conversation-capture`、`site-adapters`。

**文件范围**：

```text
packages/adapters/src/registry.ts
packages/adapters/src/platforms/synthetic.ts
packages/adapters/fixtures/synthetic/**
packages/adapters/test/platforms/synthetic.test.ts
apps/extension/contents/chatstash.tsx
apps/extension/src/content/**
apps/extension/src/ui/save-control/**
apps/extension/test/content/**
```

- [ ] 6.1 实现 `SiteAdapter`、target/capture/diagnostic 类型和显式 registry；Adapter 无 observer/network/auth/UI side effect。
- [ ] 6.2 实现仅开发/测试使用的 synthetic Adapter + fixture，覆盖多轮 prompt 配对、streaming、invalid 和 DOM replacement。
- [ ] 6.3 实现 content runtime：当前 URL match、以 Plasmo CSUI 为唯一永久 discovery observer、incremental/debounced discovery、route change cleanup、WeakMap target tracking、重复 mount 防护；不得叠加第二个 document 级 observer。
- [ ] 6.4 用 Plasmo Shadow DOM/inline anchors 实现 Save 控件和 finite state machine；点击时重新校验 streaming，saving 锁定，正确显示 created/duplicate/error/retry。
- [ ] 6.5 测试新增/替换节点、SPA URL 变化、cleanup、多个 targets、一 target 一 control 和 error mapping。

**自动验证**：

```bash
corepack pnpm --filter @chatstash/adapters test
corepack pnpm --filter @chatstash/extension test
corepack pnpm typecheck
corepack pnpm lint
```

**人工验收**：在本地 synthetic fixture 页面进行 DOM append/replace/streaming 切换；每个 response 始终至多一个控件；保存到本地数据库后 duplicate 状态正确；route 切换后旧 observer/UI 被清理。

**停止条件**：synthetic 纵切通过后移除生产 registry 中的 synthetic Adapter（fixture/test 保留），汇报并停止。

---

## 阶段 7 — DeepSeek Adapter

**Goal**：基于实施当天真实、已脱敏证据支持 DeepSeek；只改平台层、fixture、registry 与权限。

**关联 capability**：`site-adapters`、`conversation-capture`。

**前置证据**：当前 `https://chat.deepseek.com/` 登录后 sanitized fixtures，至少包含普通多轮、rich Markdown、streaming、primary 缺失/fallback、invalid；并记录取样日期和验证的页面 URL 形态。

**文件范围**：

```text
packages/adapters/src/platforms/deepseek.ts
packages/adapters/fixtures/deepseek/**
packages/adapters/test/platforms/deepseek.test.ts
packages/adapters/src/registry.ts
apps/extension/package.json 或 Plasmo manifest 配置  # 仅 DeepSeek host
```

- [ ] 7.1 从 fixture 记录 primary/fallback/validation 表，不使用无法解释的生成 class 作为唯一 selector。
- [ ] 7.2 实现 DeepSeek URL match、response targets、prompt pairing、mount point、streaming、source metadata、canonical URL 和 message extraction。
- [ ] 7.3 用共享 Markdown converter 排除 copy/regenerate/feedback/ChatStash UI 等噪声；不复制核心保存逻辑。
- [ ] 7.4 完成 Adapter contract tests 与 fixture snapshots，验证 primary/fallback/streaming/invalid、多轮早期 response。
- [ ] 7.5 只增加 `https://chat.deepseek.com/*` 页面权限，生产 build 后真实站点 smoke test 保存与 duplicate。

**自动验证**：

```bash
corepack pnpm --filter @chatstash/adapters test -- deepseek
corepack pnpm --filter @chatstash/extension test
corepack pnpm --filter @chatstash/extension build
```

**人工验收**：普通/代码/表格回复各保存一次；streaming 中不可保存；完成后可保存；早期 turn 配对正确；SPA 新对话和历史对话切换无重复；数据库正文不含站点按钮文本。

**阻塞规则**：没有当前 sanitized fixture 或无法验证 streaming signal 时，不写猜测 selector，报告缺失证据并停止。

**停止条件**：fixture contract 与真实 smoke 全部通过后汇报并停止。

---

## 阶段 8 — ChatGPT Adapter

**Goal**：在不修改核心保存逻辑的前提下增加 ChatGPT 支持。

**关联 capability**：`site-adapters`、`conversation-capture`。

**前置证据**：当前 `https://chatgpt.com/` 登录后 sanitized fixtures，覆盖与阶段 7 相同的情形，并包含 regenerate/分支存在时的配对证据。

**文件范围**：

```text
packages/adapters/src/platforms/chatgpt.ts
packages/adapters/fixtures/chatgpt/**
packages/adapters/test/platforms/chatgpt.test.ts
packages/adapters/src/registry.ts
apps/extension/package.json 或 Plasmo manifest 配置  # 仅 ChatGPT host
```

- [ ] 8.1 记录并实现 ChatGPT primary/fallback/validation、URL match、targets、pair、mount、streaming、metadata 与 extraction。
- [ ] 8.2 对 regenerate/branch/编辑后的 DOM 只保存当前目标所属的可验证 prompt-response pair；模糊时 fail closed。
- [ ] 8.3 使用相同 contract suite，补 ChatGPT 专有 fixtures；不得在 content runtime 加 `if ChatGPT` 分支。
- [ ] 8.4 只增加 `https://chatgpt.com/*` 页面权限，生产 build 后完成真实站点保存、duplicate、SPA smoke。
- [ ] 8.5 对两个 Adapter 运行一致性测试，证明新增 ChatGPT 未破坏 DeepSeek。

**自动验证**：

```bash
corepack pnpm --filter @chatstash/adapters test
corepack pnpm --filter @chatstash/extension test
corepack pnpm --filter @chatstash/extension build
```

**人工验收**：同阶段 7，并额外验证 regenerate/branch 可见案例；manifest 只含两个 AI host 与 Supabase origin，没有 `<all_urls>`。

**阻塞/停止规则**：同阶段 7。

---

## 阶段 9 — Dashboard 收藏列表与详情

**Goal**：在真实数据库上展示 Extension 保存的快照，完成安全 Markdown 阅读和删除闭环。

**关联 capability**：`conversation-library`。

**文件范围**：

```text
apps/web/app/(dashboard)/**
apps/web/components/layout/**
apps/web/features/conversations/**
apps/web/features/markdown/**
apps/web/lib/validation/conversations.ts
apps/web/test/conversations/**
apps/web/test/markdown/**
apps/web/package.json
pnpm-lock.yaml
```

- [ ] 9.1 实现 Sidebar/List/Viewer 响应式 shell；初始数据来自真实 Supabase，不使用长期 mock。
- [ ] 9.2 实现 owned conversation summary cursor query，固定 `saved_at DESC,id DESC`，每页默认 30；empty/loading/error 与 no data 区分。
- [ ] 9.3 实现 detail query、ordered messages、same not-found for missing/unowned、canonical source link 和 metadata。
- [ ] 9.4 实现无 raw HTML 的 GFM Markdown renderer、static code highlight、safe protocols/rel；恶意 Markdown tests 证明不执行。
- [ ] 9.5 实现明确确认的 conversation delete 和失败 reconciliation；级联结果由数据库测试覆盖。

**自动验证**：

```bash
corepack pnpm --filter @chatstash/web lint
corepack pnpm --filter @chatstash/web typecheck
corepack pnpm --filter @chatstash/web test
corepack pnpm --filter @chatstash/web build
```

**人工验收**：用 Extension 保存至少两条；Dashboard 刷新后按时间稳定展示；详情 GFM/代码可读且恶意 HTML 不执行；source 新窗口安全打开；删除只移除目标快照/message/join。

**停止条件**：真实纵切和安全测试通过后汇报并停止。

---

## 阶段 10 — 文件夹与标签

**Goal**：实现不破坏数据的层级组织、移动、标签管理和组合筛选。

**关联 capability**：`content-organization`。

**文件范围**：

```text
apps/web/features/folders/**
apps/web/features/tags/**
apps/web/features/conversations/**  # 仅 move/filter/tag integration
apps/web/components/layout/**       # 仅 sidebar tree/tag list
apps/web/lib/validation/organization.ts
apps/web/test/folders/**
apps/web/test/tags/**
```

- [ ] 10.1 从一次 owned flat folder query 构建 UI tree；防御 orphan/cycle 只用于显示错误，数据库仍是权威；不做每节点 N+1 查询。
- [ ] 10.2 实现 folder create/rename/reparent，父级选择排除自身/后代；数据库 conflict/cycle 错误映射为可修正文案。
- [ ] 10.3 删除必须调用 `delete_folder_v1`，对提升重名显示冲突并保持 UI/数据库不变；成功后刷新 tree/list。
- [ ] 10.4 实现 conversation move/clear folder；folder filter 只匹配直接归属。
- [ ] 10.5 实现 tag create/rename/delete、attach/detach 幂等和 tag filter；folder + tag 取交集。
- [ ] 10.6 测试 deep tree、cycle candidate、same normalized name、delete promote/conflict、cross-user action、combined filters 和 errors。

**自动验证**：同阶段 9，外加 `supabase test db`。

**人工验收**：创建至少三层 folder；移动 conversation/folder；尝试自环/后代环失败；删除中间 folder 时 child 提升、conversation 到 All Saves；构造重名冲突时整单回滚；tag filter 与 folder filter 交集正确。

**停止条件**：数据库与 Web 验收全部通过后汇报并停止。

---

## 阶段 11 — 搜索

**Goal**：提供 title + message Markdown 的中英文基础搜索，并与组织筛选和 cursor 正确组合。

**关联 capability**：`conversation-search`。

**文件范围**：

```text
apps/web/features/search/**
apps/web/features/conversations/**  # 仅搜索结果 integration
apps/web/app/(dashboard)/**         # 仅 URL params integration
apps/web/lib/validation/search.ts
apps/web/test/search/**
supabase/migrations/**              # 仅在阶段 2 基线需经证据修正时新增 forward migration
supabase/tests/database/search*.sql
```

- [ ] 11.1 实现 trim、2..200 限制、debounce、URL query/filter state 和 query 变化取消/忽略旧响应；空白退出 search。
- [ ] 11.2 调用 `search_conversations_v1`，展示 summary 与 deterministic cursor page；不把完整 messages 或 HTML highlight 返回列表。
- [ ] 11.3 支持 folder/tag/search 交集；query/filter 变化丢弃旧 cursor。
- [ ] 11.4 测试 title 优先、body-only、Chinese substring、case、punctuation/operator input、same conversation once、no-result vs error、cross-user isolation 和 pagination。
- [ ] 11.5 使用代表性数据运行 EXPLAIN，确认 owner filter 与至少一种 FTS/trigram 索引路径可用；记录结果，不为小样本强行调参。

**自动验证**：Web 门禁 + `supabase test db` + `supabase db lint --level warning`。

**人工验收**：用英文、中文、代码片段搜索 title/user/assistant 内容；folder/tag 交集正确；无结果与断网错误不同；翻页无重复。

**停止条件**：功能、隔离和查询计划证据通过后汇报并停止。

---

## 阶段 12 — 单篇 Markdown 导出

**Goal**：从存储事实生成确定、安全、跨平台可用的单篇 Markdown 文件。

**关联 capability**：`markdown-export`。

**文件范围**：

```text
apps/web/features/export/**
apps/web/features/conversations/**  # 仅 detail action integration
apps/web/test/export/**
```

- [ ] 12.1 实现纯 formatter：固定 metadata、position order、optional omission、verbatim stored Markdown 和单个 final newline。
- [ ] 12.2 实现 safe filename：非法/控制字符、reserved names、dot path、长度、empty fallback 和 `.md` 后缀。
- [ ] 12.3 实现 browser Blob download adapter；unowned/not-found 不生成文件，不写 Supabase Storage。
- [ ] 12.4 用 golden tests 覆盖 code fence/table/link/Unicode/optional metadata/ISO time/unsafe filename；detail UI 完成一次下载。

**自动验证**：Web lint/typecheck/test/build。

**人工验收**：下载含中英文标题、表格和代码块的记录；UTF-8、文件名和 Markdown 内容正确；下载不产生数据库新记录。

**停止条件**：golden 和浏览器下载通过后汇报并停止。

---

## 阶段 13 — 生产加固与发布候选

**Goal**：不新增产品功能，只验证安全、可靠性、权限、性能和可部署性，形成可人工发布的 MVP candidate。

**关联 capability**：全部。

**文件范围**：

```text
apps/**
packages/**
supabase/**
docs/release-checklist.md
package.json
pnpm-lock.yaml
```

- [ ] 13.1 全量 dependency/secret/permission audit：无 privileged key、真实 fixture/token、`<all_urls>`、多余 Chrome permission、raw HTML renderer 或完整正文日志。
- [ ] 13.2 运行 fresh clone/frozen install、format/lint/typecheck/unit tests、Supabase reset/lint/pgTAP、generated type diff、Web/Extension production builds。
- [ ] 13.3 用 user A/B 执行端到端安全回归；核对 Data API grants、RLS enabled、function EXECUTE、cross-owner opaque not-found。
- [ ] 13.4 在当前 ChatGPT/DeepSeek 做 Adapter smoke；记录日期、浏览器/extension build、primary/fallback、streaming、SPA、duplicate 结果，不记录对话正文。
- [ ] 13.5 检查 MutationObserver 批处理/cleanup、Extension bundle/permissions、Dashboard list/search query count 和 representative EXPLAIN；只修有证据的问题。
- [ ] 13.6 编写 `docs/release-checklist.md`：Supabase migration/redirect/env、Vercel/Web deploy、Extension unpacked/Chrome Web Store 手工步骤、rollback、已知限制。
- [ ] 13.7 对照 7 个 spec 逐场景验证实现证据，运行 OpenSpec strict validation；未实现/未测 scenario 不得标完成或归档。

**最终自动验证**：

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
supabase db reset
supabase db lint --level warning
supabase test db
corepack pnpm --filter @chatstash/web build
corepack pnpm --filter @chatstash/extension build
openspec validate establish-chatstash-mvp --strict
```

**最终人工验收**：

1. Web 创建/确认 user A；Extension 独立登录 A。
2. DeepSeek 与 ChatGPT 各保存普通、代码/表格内容；streaming gate 与 duplicate 正确。
3. Dashboard 能列表/详情、安全渲染、folder/tag 组织、中英文搜索和导出。
4. user B 无法读、关联、修改、删除或从错误差异推断 A 的数据。
5. Extension 只申请两个 AI host、Supabase origin 和 `storage`，并且 production logs 无正文/token。

**停止条件**：所有阶段任务已勾选、最终命令成功、release checklist 完成后，运行 OpenSpec verify/sync/archive 流程；未满足时只报告缺口，不宣称 MVP 完成。
