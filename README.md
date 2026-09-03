# ChatStash（快存）

面向 AI 重度用户的跨平台 AI 对话收藏与知识管理工具。在 ChatGPT、DeepSeek 等对话页点击回复旁的「保存」按钮，即可将 Prompt 与 AI 回复一键存到云端，并在 Web Dashboard 统一浏览、整理、搜索和导出。

## 功能

- **Chrome 扩展（MV3）**：在 AI 回复旁注入保存按钮，抓取内容转 Markdown 保存，支持登录检测、防重复提交、失败重试。
- **Adapter 架构**：平台 DOM 逻辑与保存流程解耦，新增平台只需新增一个 Adapter 文件。
- **Web Dashboard**：登录、列表与详情、无限层级文件夹、标签、全文搜索、Markdown 导出。
- **Markdown First**：正文只存 Markdown，展示 / 搜索 / 导出共用一份数据。
- **安全**：Supabase RLS 数据隔离、仅用 publishable key、最小权限扩展。

**已支持平台**：DeepSeek、ChatGPT（另有 Synthetic 用于本地开发测试）。

## 架构

交互式架构图（可切换主题 / 缩放 / 聚焦视图，来自 [Archify](https://archify.ai)）：

[![ChatStash 架构总览](docs/screenshots/chatstash-architecture.png)](docs/chatstash-architecture.html)

```text
AI 页面 → Content Script（采集，无 token）
        → Background Service Worker（持会话并联网）
        → Supabase（Auth / Data API / RPC / RLS）
        ← Next.js Dashboard（SSR Cookie + JWT）
```

- 扩展只在用户点击保存后才上传该次问答，不自动采集页面。
- Web 与扩展共享同一账号，但各自独立管理会话。
- 前端只用 publishable key，授权全部落在 RLS 与数据库约束。

## 仓库结构

pnpm workspace Monorepo：

```text
apps/extension   Chrome 扩展（Plasmo · MV3 · React · TS）
apps/web         Web Dashboard（Next.js App Router · Tailwind）
packages/shared  数据契约、平台规则、消息协议
packages/adapters 平台 Adapter、Markdown 转换、DOM fixtures
supabase         migrations、seed、pgTAP 数据库测试
docs/            项目文档
openspec/        MVP 规格与实现基线
```

数据库核心实体：`profiles`、`folders`（无限层级）、`conversations`、`messages`、`tags`、`conversation_tags`。多步操作经版本化 RPC（如 `save_capture_v1`）单事务完成，用确定性 `dedupe_key` + 唯一约束实现幂等。

## 快速开始

要求：Node.js >= 20.19、pnpm（corepack）、Supabase CLI + Docker。

```bash
corepack enable
corepack pnpm install
pnpm db:reset            # 启动本地 Supabase 并应用 migrations + seed

cp apps/web/.env.example apps/web/.env.local
cp apps/extension/.env.example apps/extension/.env.local   # 填入本地 Supabase URL 与 publishable key

pnpm dev                 # 并行启动 extension 与 web
```

扩展在 Chrome 加载 `apps/extension/build/chrome-mv3-dev` 目录。

> 只配置公开配置；`service_role_key` 等秘密严禁进入前端或仓库。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` / `pnpm build` | 开发 / 构建 |
| `pnpm test` / `pnpm lint` / `pnpm typecheck` | 测试 / 检查 |
| `pnpm db:reset` / `pnpm db:test` / `pnpm db:types` | 重置数据库 / 数据库测试 / 重新生成类型 |

## 文档

- `openspec/changes/establish-chatstash-mvp/` — MVP 规格与分阶段任务（实现基线）
- `docs/manual-acceptance-guide.md`、`docs/release-checklist.md` — 验收与发布
- `docs/ai-development-spec.md` — 原始产品愿景与工程规范存档
