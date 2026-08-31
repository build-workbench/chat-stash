# 低成本模型实施交接说明

## 文档优先级

后续实现时按以下顺序解释需求：

1. 当前阶段相关的 `openspec/changes/establish-chatstash-mvp/specs/*/spec.md`：可观察行为与验收标准。
2. `openspec/changes/establish-chatstash-mvp/design.md`：技术决策、边界和数据不变量。
3. `openspec/changes/establish-chatstash-mvp/tasks.md`：阶段顺序、文件范围、命令和停止条件。
4. `openspec/changes/establish-chatstash-mvp/proposal.md`：目标、范围和非目标。
5. `docs/ai-development-spec.md`：原始产品愿景；若有歧义，以已经评审的 OpenSpec change 为准。

不要一次把 14 个阶段交给同一个低成本模型。一次会话只给一个阶段，验收通过后再开始下一阶段。

## 每阶段最小上下文包

给实现模型提供：

- `openspec/config.yaml`
- `proposal.md`
- `tasks.md` 中“执行协议”和当前阶段全文
- `design.md` 中当前阶段标注的章节；涉及数据库、安全、信任边界时同时提供 §3、§5、§6
- 当前阶段列出的 capability spec
- 当前 `git status --short` 和已有相关文件

阶段 7/8 还必须提供实施当天的脱敏 DOM fixtures；没有 fixture 就不启动该阶段。

## 可复制的实施提示词

```text
你现在只实施 ChatStash OpenSpec 的“阶段 <N> — <名称>”。

先完整读取：
1. openspec/config.yaml
2. openspec/changes/establish-chatstash-mvp/proposal.md
3. openspec/changes/establish-chatstash-mvp/tasks.md 的“执行协议”和阶段 <N>
4. 阶段 <N> 引用的 design.md 章节
5. 阶段 <N> 关联的 capability spec

执行约束：
- 先运行 git status --short，保留已有修改。
- 只能修改该阶段“文件范围”列出的路径；需要越界时停止并说明。
- 不提前实现下一阶段，不做非目标功能，不改变已定技术栈。
- 先说明新增依赖的 package、purpose、why needed，再安装兼容稳定版本并更新 lockfile。
- 不用 TODO、伪代码、空 handler、any、长期 mock 或猜测的第三方 API/DOM 代替实现。
- 需求冲突时以 spec 的行为为最高优先级，以 design 决定实现；不要自行改变架构。
- 缺少真实配置、当前官方 API 证据或脱敏 DOM fixture 时停止并列出所需材料，不要猜。
- 完成代码后运行该阶段全部自动验证，并执行人工验收；失败就定位修复，不要勾选任务。
- 只有验收通过后才把本阶段 task 改为 [x]。

结束时只汇报：
1. 完成的 task
2. 修改的文件
3. 执行的验证命令及结果
4. 人工验收结果
5. 剩余风险或阻塞

完成当前阶段后停止，不继续下一阶段。
```

## 评审提示词

建议每个实现阶段结束后，用另一个会话只做审查，不直接改代码：

```text
请只审查 ChatStash 阶段 <N> 的实现是否符合对应 spec、design 和 tasks。
逐项给出文件/行号证据，按 Critical、Warning、Suggestion 分类。
重点检查：越过阶段范围、未实现 scenario、RLS/信任边界、错误与回滚语义、测试是否只验证 mock、权限或依赖扩大、TODO/any/过度抽象。
不要修改文件。若无 Critical/Warning，明确列出已核验的阶段验收门槛。
```

## 阶段推进记录

只以 `tasks.md` checkbox 和实际验证结果为完成依据。模型自述“已完成”不构成证据；构建、测试或人工 smoke 未运行时，该阶段保持未完成。
