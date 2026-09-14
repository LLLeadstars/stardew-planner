# Issue tracker: GitHub

任务与规格保存在当前仓库的 GitHub Issues，使用 gh CLI 操作。
在仓库目录运行，通过 git remote 确认目标仓库。

## 常用操作

- 创建：gh issue create --title "标题" --body-file <正文文件>
- 读取：gh issue view <编号> --comments；需要结构化信息时使用 --json。
- 列表：gh issue list，按需使用 --state、--label 和 --json。
- 评论：gh issue comment <编号> --body-file <正文文件>
- 添加标签：gh issue edit <编号> --add-label "<标签>"
- 移除标签：gh issue edit <编号> --remove-label "<标签>"
- 关闭：gh issue close <编号>

多行正文先写入临时文件，再通过 --body-file 提交，保留真实换行。

技能要求“发布到任务管理系统”时，创建 GitHub Issue。
技能要求“获取相关任务”时，读取对应 Issue 及评论。

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Wayfinding operations

- Map：使用标记为 wayfinder:map 的 Issue，
  正文包含 Notes、Decisions-so-far、Fog。
- 子任务：使用 GitHub sub-issues 关联到 Map；
  不可用时，在 Map 中维护任务列表，并在子任务顶部写 Part of #<编号>。
- 类型：使用 wayfinder:research、wayfinder:prototype、
  wayfinder:grilling、wayfinder:task 标签。
- 阻塞：优先使用 GitHub 原生 Issue dependencies，
  关联时使用阻塞任务的数据库 id，而非 Issue 编号；
  不可用时，在正文顶部写 Blocked by: #<编号>。
- 可执行任务：按 Map 顺序选择尚未关闭、无人认领、
  且所有阻塞任务均已关闭的第一个子任务。
- 认领：开始工作前，将任务指派给当前执行者。
- 完成：追加答案评论、关闭子任务，
  并在 Map 的 Decisions-so-far 中追加结论摘要和链接。
