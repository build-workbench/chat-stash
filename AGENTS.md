# AGENTS.md — ChatStash（拾语）

面向 AI 重度用户的跨平台 AI 对话收藏与知识管理工具：Chrome 扩展在 ChatGPT/DeepSeek 页面一键保存问答至 Supabase，Web Dashboard 统一整理、搜索与导出 Markdown。

## 常用命令

- `pnpm dev` — 并行启动 Web 与 Extension 开发服务
- `pnpm build` — 全量打包构建（递归所有 workspace）
- `pnpm lint` / `pnpm typecheck` — 递归运行 ESLint / `tsc --noEmit`
- `pnpm test` — 递归运行 vitest 单测
- `pnpm format:check` — Prettier 格式检查
- `pnpm db:reset` — 重置本地 Supabase 数据库（自动应用 migrations + seed，需 Docker）
- `pnpm db:types` — 重新生成 `packages/shared/src/database.types.ts`
- `pnpm db:lint` / `pnpm db:test` — 数据库 lint / 数据库级测试（需本地 Supabase 运行中）

## 代码结构

pnpm workspace 单仓多包（`apps/*`、`packages/*`），全 TypeScript（strict）+ ESM。

- `apps/extension/` — Chrome 扩展（Plasmo · MV3 · React）：`src/background.ts` 后台 SW、`src/contents/` 页面注入 UI、`src/capture/` 保存流程、`src/auth/`、`src/messaging/`
- `apps/web/` — Web Dashboard（Next.js App Router · Tailwind · @supabase/ssr）：`app/` 路由（含 `(auth)`、`(dashboard)`）、`features/` 功能纵切（conversations/folders/search/export 等）；另有自身 `AGENTS.md`（Next.js 自动生成规则，勿删）
- `packages/adapters/` — 平台 DOM 解析与 HTML→Markdown 转换：`src/platforms/`（chatgpt/deepseek/synthetic 适配器）、`src/registry.ts` 注册表、`fixtures/` 脱敏页面样本
- `packages/shared/` — Zod 数据契约、后台协议、错误与限额模型、`database.types.ts`（由 `pnpm db:types` 生成，勿手改）
- `supabase/` — `migrations/` 表结构与 RLS、`seed.sql`、`tests/database` 数据库级测试
- `scripts/` — 基于 puppeteer-core 的 DeepSeek 真实页面样本采集脚本
- `docs/` — 产品规范、验收指南、发布清单等文档；`openspec/` — MVP 规格与任务基线

## 关键约束

- Node.js >= 20.19；pnpm 由 `packageManager`（pnpm@11.21.0）经 corepack 锁定；CI 在 Node 22 上执行 `pnpm lint` + `pnpm typecheck`，依赖以 `--frozen-lockfile` 安装
- Prettier：无分号、单引号、尾逗号 `all`、`printWidth 100`（见 `prettier.config.mjs`）
- TypeScript 全仓 strict（`tsconfig.base.json`，`target ES2022`）；workspace 间以 `workspace:*` 引用，源码直出（exports 指向 `src/index.ts`）
- 本地开发顺序：`pnpm install` → `pnpm db:reset` → 按 README 复制 `apps/*/.env.example` 为 `.env.local` → `pnpm dev`
- 扩展 dev 产物在 `apps/extension/build/chrome-mv3-dev`，Chrome 加载该目录调试
- 新平台适配器走 Adapter/Registry 架构（`packages/adapters`），须配 fixtures 测试；数据访问仅经 Supabase RPC，RLS 行级隔离不可绕过

## 文档约定

- CHANGELOG.md：面向用户的变更在合入时写入 [Unreleased]（Keep a Changelog zh-CN 格式）
- 文档全中文
