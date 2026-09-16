# PC 原版 1.6.15：V1 作物照料数据核验

## 研究范围

本报告只为 Wayfinder 决策票“确定作物照料的支持范围与生长推进规则”提供事实依据，不扩展为完整攻略或商品数据库。范围固定为 PC 原版 1.6.15、无模组、普通室外耕地、无肥料；温室、肥料、格子作物和其他特殊条件按产品决策降级为手动模式。

## 证据与来源

1. [stardew-data 的固定版本来源说明](https://github.com/juliaramosguedes/stardew-data/blob/4e0d98119afefd766f15ee77a529db4eb71fa240/SOURCES.md) 声明数据直接提取自游戏解包文件 `Content (unpacked)/Data/*.json`，并标注游戏版本为 1.6.15。该仓库不是 ConcernedApe 官方仓库，因此这是可追溯的游戏数据提取物，不等同于官方公开 API。
2. [固定提交的 `data/en-US/crops.json`](https://github.com/juliaramosguedes/stardew-data/blob/4e0d98119afefd766f15ee77a529db4eb71fa240/data/en-US/crops.json) 的 `_meta` 标注来源为 `Data/Crops.json + Data/Objects.json`、`gameVersion: 1.6.15`。本报告使用其中的 `seasons`、`growthDays`、`regrowDays`、`isRaised` 和 `isPaddyCrop`。
3. [固定提交的作物解析器](https://github.com/juliaramosguedes/stardew-data/blob/4e0d98119afefd766f15ee77a529db4eb71fa240/scripts/parsers/crops.ts) 明确将原始 `DaysInPhase` 求和为 `growthDays`，将正数 `RegrowDays` 保留为 `regrowDays`，否则记为无重复收获。
4. 关于版本背景，可参考 ConcernedApe 的 [Stardew Valley 1.6 完整更新日志](https://www.stardewvalley.net/stardew-valley-1-6-update-full-changelog/)。它不是本报告作物数值的直接来源。

## 数据盘点

固定数据集包含 50 条作物记录。按“非格子、非水田、没有 forage 标签”的产品筛选得到 40 条 V1 默认数据条目：

- 格子作物（`isRaised=true`，不纳入普通室外矩阵）：Grape、Green Bean、Hops。
- 水田作物（`isPaddyCrop=true`，不纳入普通室外矩阵）：Taro Root、Unmilled Rice。
- 其他带 forage 标签、且不属于上述两类的条目：Cactus Fruit、Common Mushroom、Spice Berry、Wild Horseradish、Winter Root。
- `Coffee Bean`、`Fiber`、`Qi Fruit` 在这份数据中具有普通非格子、非水田标记，因此暂按“数据级基础生长条目”保留；种子获取、任务来源等不属于本 V1 生长规则范围。若玩家输入了额外特殊条件，仍按“规则未验证”。

## V1 默认作物矩阵

下表是数据层可直接用于普通室外、无肥料条件的候选条目。季节表示数据记录允许的种植季节；生长天数和重复收获间隔是游戏数据字段，不是保证玩家完成活动的精确耗时。

| 作物 | 数据中的种植季节 | 首次生长天数 | 重复收获间隔 |
| --- | --- | ---: | ---: |
| Amaranth | Fall | 7 | — |
| Ancient Fruit | Spring、Summer、Fall | 28 | 7 |
| Artichoke | Fall | 8 | — |
| Beet | Fall | 6 | — |
| Blue Jazz | Spring | 7 | — |
| Blueberry | Summer | 13 | 4 |
| Bok Choy | Fall | 4 | — |
| Broccoli | Fall | 8 | 4 |
| Carrot | Spring | 3 | — |
| Cauliflower | Spring | 12 | — |
| Coffee Bean | Spring、Summer | 10 | 2 |
| Corn | Summer、Fall | 14 | 4 |
| Cranberries | Fall | 7 | 5 |
| Eggplant | Fall | 5 | 5 |
| Fairy Rose | Fall | 12 | — |
| Fiber | Spring、Summer、Fall、Winter | 7 | — |
| Garlic | Spring | 4 | — |
| Hot Pepper | Summer | 5 | 3 |
| Kale | Spring | 6 | — |
| Melon | Summer | 12 | — |
| Parsnip | Spring | 4 | — |
| Pineapple | Summer | 14 | 7 |
| Poppy | Summer | 7 | — |
| Potato | Spring | 6 | — |
| Powdermelon | Winter | 7 | — |
| Pumpkin | Fall | 13 | — |
| Qi Fruit | Spring、Summer、Fall、Winter | 4 | — |
| Radish | Summer | 6 | — |
| Red Cabbage | Summer | 9 | — |
| Rhubarb | Spring | 13 | — |
| Starfruit | Summer | 13 | — |
| Strawberry | Spring | 8 | 4 |
| Summer Spangle | Summer | 8 | — |
| Summer Squash | Summer | 6 | 3 |
| Sunflower | Summer、Fall | 8 | — |
| Sweet Gem Berry | Fall | 24 | — |
| Tomato | Summer | 11 | 4 |
| Tulip | Spring | 6 | — |
| Wheat | Summer、Fall | 4 | — |
| Yam | Fall | 10 | — |

## 产品处理边界

| 条件 | V1 处理 |
| --- | --- |
| 普通室外耕地、无肥料，且作物在上表 | 允许建立批次，并按数据字段进行条件性生长/收获推算。 |
| 温室、肥料、格子作物、水田作物或其他特殊条件 | 仍允许建立批次，但标记“规则未验证”；不自动推算生长、收获或跨季结果，玩家手动填写日期和照料安排。 |
| 数据中 `seasons` 包含多个季节 | 只作为可种植季节参考；是否能跨季保留不能仅由该字段推出。 |
| 未知作物或未知条件 | 停在最后一个确定状态，显示黄色提示，不伪造确定日期。 |

## 已确认的生长推进语义

以下是产品决策，不声称都能从上述数据文件单独推出：

- 计划作物批次在种植活动实际完成后才激活，实际完成日作为生长起点。
- 每个批次必须有相同的作物、实际种植日期、环境和肥料条件；部分供水按玩家填写数量显式拆分，不猜测具体植株。
- 人工浇水、雨水和洒水器都算当日供水。标记今天或明天下雨后，对应日期的浇水任务自动完成；标记某批次受到洒水器覆盖后，从生效日期起的后续浇水任务自动完成。
- 在支持范围内，未供水日不推进生长，预计收获日相应顺延；历史缺少供水记录按漏浇，未来日期没有记录只是预测。
- 一次收获作物在首次收获后结束；重复收获作物的下一轮以实际完成收获日为起点。预计收获日经过但没有事实记录时，不自动视为已收获、死亡或失败。
- 铲除、死亡、停止照料和已核验的季节失效是批次状态事件，不占用日程时间；事件生效日后的系统安排停止，历史供水和完成记录保留，继续照料需新建计划批次。
- 雨水、洒水器标记发生变化时，只修正系统自动记录；玩家手动完成或手动调整的记录受保护。

## 证据缺口与可执行降级

这份游戏数据提取物足以支撑作物名称、种植季节、首次生长天数、重复收获间隔以及格子/水田分类，但不能单独证明以下运行时行为：

- 某个未供水日如何影响每个生长阶段；
- 雨水、洒水器和部分供水在游戏内的逐日推进细节；
- 普通作物跨季时的存活、枯萎和终止时点；
- 实际收获日变化后，游戏内部重复收获计时的全部边界。

因此 V1 不填未经核验的精确系数；遇到上述缺口或不在默认矩阵的条件，使用“规则未验证”手动模式。后续若要把黄色边界升级为确定规则，验收环境固定为 PC 原版 1.6.15、无模组，并用正常、漏浇、补标、部分供水、实际晚收获和跨季场景做实机回归。

