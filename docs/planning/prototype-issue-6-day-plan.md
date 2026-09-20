# 交互原型位置记录：`prototype/issue-6-day-plan`

来源票：[#6 验证电脑端规划主流程与编辑交互](https://github.com/LLLeadstars/stardew-planner/issues/6)。

本文件只记录原型产物的存放位置，方便实施代理找到并查阅。
原型**未**合入 main：该分支自身的 README 明确写着「这不是产品代码，不要合并进 main」，
且合并会改动 main 上已有文档，与本票「只新增文档、无产品代码变更」的验收条件冲突。

## 分支与远端

- 分支：`prototype/issue-6-day-plan`
- 远端：`origin/prototype/issue-6-day-plan`（https://github.com/LLLeadstars/stardew-planner/tree/prototype/issue-6-day-plan）
- 分支基点：`d81d8d1`（与当前 main 的合并基一致）

## 产物清单

| 路径（分支内） | 说明 |
|---|---|
| `prototypes/issue-6-day-plan/index.prototype.html` | 原型本体；已确认最终形态为三栏布局 F，双击即可运行，无构建、无依赖 |
| `prototypes/issue-6-day-plan/variants-archive.prototype.html` | 已删除变体（A/B/C/E）的快照，保留为 UI 分支的 primary source |
| `prototypes/issue-6-day-plan/selftest.model.js` | 模型层断言，`node selftest.model.js` 运行 |
| `prototypes/issue-6-day-plan/selftest.render.js` | 渲染烟雾扫描与结构断言，`node selftest.render.js` 运行 |
| `prototypes/issue-6-day-plan/README.md` | 原型说明、已确认的交互决定、已知占位与缺口 |

## 查阅方式

```
git show prototype/issue-6-day-plan:prototypes/issue-6-day-plan/README.md
git show prototype/issue-6-day-plan:prototypes/issue-6-day-plan/index.prototype.html > index.prototype.html
```

或在本地检出该分支：`git switch prototype/issue-6-day-plan`。

## 使用边界

- 原型代码按「只求能跑」标准编写，无错误处理、无抽象、无测试覆盖承诺，**不得直接提升为产品实现**。
- 原型中的浇水估算系数是占位值，门店判定的实机回归未做，这些结论以对应研究文档与 GitHub Issue 为准。
- 该分支还包含一处 `CONTEXT.md` 对「田地密集程度」措辞的细化（V1 浇水按时间预留，不要求填写此类别），如需采纳请单独走领域建模流程，不随本记录合入。
