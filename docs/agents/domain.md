# Domain Docs

## 布局

采用 single-context：
- 根目录 CONTEXT.md：领域术语与模型。
- docs/adr/：架构决策记录。

## 读取规则

探索代码库前，读取 CONTEXT.md 和与当前工作相关的 ADR。
若以后出现 CONTEXT-MAP.md，先读取该索引，再读取相关上下文文档。

上述文件不存在时直接继续；由 domain-modeling 技能
在术语或决策明确后按需创建。

## 术语与决策

输出中的领域概念使用 CONTEXT.md 定义的术语。
缺少所需概念时，先判断是否符合项目现有语言；
确有缺口时，记录为后续领域建模事项。

方案与已有 ADR 冲突时，明确指出 ADR 编号、
冲突内容及重新讨论的理由。
