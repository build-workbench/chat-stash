# 更新日志

ChatStash（拾语）是面向 AI 重度用户的 AI 对话收藏与知识管理工具：Chrome 扩展在 ChatGPT /
DeepSeek 页面一键保存问答，Web 端统一整理、搜索与导出。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- 初始化仓库，记录项目概览与架构说明，并补充基于 OpenSpec 的 MVP 计划与实现路线图。
- 建立 pnpm workspace 单仓多包骨架（`apps/extension`、`apps/web`、`packages/shared`、
  `packages/adapters`），接入 ESLint / Prettier / TypeScript 质量门禁。
- Supabase 数据层：枚举与表结构、触发器、RLS 行级隔离与授权，以及原子化保存 / 删除 RPC、
  全文搜索 RPC 和标签分页列表 RPC。
- 数据库级测试覆盖 schema 结构、RLS 隔离、保存去重与幂等、文件夹循环删除等关键路径。
- 共享契约层：抓取契约、后台协议、游标与平台定义、错误与限额模型，以及基于 Turndown 的
  HTML → 标准 Markdown 转换核心。
- Web 端认证纵切：注册 / 登录 / 认证回调 / 重置密码与受保护 Dashboard。
- Web 端知识库功能：会话列表与详情、全文搜索、无限层级文件夹与 Markdown 导出。
- 扩展端 MV3 纵切：后台 Service Worker 与弹窗的登录、保存流程，内容脚本运行时与页面内
  保存控件状态机。
- 平台适配器：synthetic 合成适配器纵切，以及生产级 ChatGPT、DeepSeek DOM 解析适配器
  （含 fixtures 与脱敏样本采集工具）。
- 接入自托管中文字体与代码字体；登录 / 注册页补齐居中卡片、品牌徽标与消息横幅设计。
- 添加 MIT LICENSE、交互式架构图资产（Archify），以及发布检查清单、搜索 EXPLAIN 记录与
  手动验收指南等文档。

### 变更

- 产品中文名称确定为 "ChatStash · 拾语"，README 重写精简，原始 AI 开发规范归档至
  `docs/ai-development-spec.md`。
- 扩展内容脚本的 host matches 切换到生产域名，打通扩展与线上页面。
- 补充 lint + typecheck 基础 CI 工作流，统一 Prettier 忽略规则。

### 修复

- 修正 RPC 可空参数处理与 `edge_runtime` 配置。
- 会话标签分页改用专用 list RPC，详情改为并行抓取，修正 Web 端游标 API 与共享
  Turndown 单例。
- 修复 async client 组件的构建告警。
