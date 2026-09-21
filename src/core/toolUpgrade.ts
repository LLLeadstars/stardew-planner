import type { GameDate } from './date';
import { addDays, compareDate, formatDate } from './date';
import type { PlayerStates, ToolKey, ToolLevel } from './playerState';
import { TOOL_OPTIONS } from './playerState';
import { judgeShop } from './shop';

/**
 * 铁匠铺支持的升级链。斧头、十字镐、锄头、喷壶、垃圾桶从基础起；
 * 淘盘从铜级起，没有「基础 → 铜」这一跳。每次只能升一级。
 */
const TOOL_CHAINS: Record<ToolKey, readonly ToolLevel[]> = {
  axe: ['basic', 'copper', 'steel', 'gold', 'iridium'],
  pickaxe: ['basic', 'copper', 'steel', 'gold', 'iridium'],
  hoe: ['basic', 'copper', 'steel', 'gold', 'iridium'],
  can: ['basic', 'copper', 'steel', 'gold', 'iridium'],
  pan: ['copper', 'steel', 'gold', 'iridium'],
  trash: ['basic', 'copper', 'steel', 'gold', 'iridium'],
};

/** 下一等级；已是链尾或等级不属于该工具链时为 null（不可跳跃升级）。 */
export function nextToolLevel(tool: ToolKey, level: ToolLevel): ToolLevel | null {
  const chain = TOOL_CHAINS[tool];
  const index = chain.indexOf(level);
  if (index < 0) return null;
  return chain[index + 1] ?? null;
}

export function toolLabel(tool: ToolKey): string {
  return TOOL_OPTIONS.find((option) => option.value === tool)?.label ?? tool;
}

export type UpgradeMaterial = { name: string; count: number };

export type ToolUpgradeOffer = {
  tool: ToolKey;
  fromLevel: ToolLevel;
  targetLevel: ToolLevel;
  materials: UpgradeMaterial[];
  cost: number;
};

const MATERIALS: Record<Exclude<ToolLevel, 'basic'>, UpgradeMaterial> = {
  copper: { name: '铜锭', count: 5 },
  steel: { name: '铁锭', count: 5 },
  gold: { name: '金锭', count: 5 },
  iridium: { name: '铱锭', count: 5 },
};

const COSTS: Record<Exclude<ToolLevel, 'basic'>, number> = {
  copper: 2000,
  steel: 5000,
  gold: 10000,
  iridium: 25000,
};

/**
 * 从当前等级出发的升级内容：目标等级、材料与费用。
 * 垃圾桶材料与其他工具相同，但费用减半；已是最高等级时返回 null。
 */
export function toolUpgradeOffer(tool: ToolKey, fromLevel: ToolLevel): ToolUpgradeOffer | null {
  const targetLevel = nextToolLevel(tool, fromLevel);
  if (!targetLevel || targetLevel === 'basic') return null;
  const baseCost = COSTS[targetLevel];
  return {
    tool,
    fromLevel,
    targetLevel,
    materials: [{ ...MATERIALS[targetLevel] }],
    cost: tool === 'trash' ? baseCost / 2 : baseCost,
  };
}

/**
 * 一件正在升级或待取回的工具。它是后台等待，不占用任何日程时间。
 * `completesOn` 固定为交付日 D+2，节日或柜台关闭都不会让它顺延。
 */
export type PendingToolUpgrade = {
  tool: ToolKey;
  fromLevel: ToolLevel;
  targetLevel: ToolLevel;
  /** 实际完成交付的游戏日 D。 */
  deliveredOn: GameDate;
  /** 交付日 +2 的完成日。 */
  completesOn: GameDate;
};

export function createPendingToolUpgrade(
  tool: ToolKey,
  fromLevel: ToolLevel,
  deliveredOn: GameDate,
): PendingToolUpgrade | null {
  const targetLevel = nextToolLevel(tool, fromLevel);
  if (!targetLevel) return null;
  return { tool, fromLevel, targetLevel, deliveredOn, completesOn: addDays(deliveredOn, 2) };
}

export type ToolUpgradePhase = 'upgrading' | 'ready';

/** 升级中直到到达完成日 D+2；当天及之后为待取回。 */
export function toolUpgradePhase(pending: PendingToolUpgrade, currentDay: GameDate): ToolUpgradePhase {
  return compareDate(currentDay, pending.completesOn) < 0 ? 'upgrading' : 'ready';
}

export const TOOL_UPGRADE_PHASE_LABELS: Record<ToolUpgradePhase, string> = {
  upgrading: '升级中',
  ready: '待取回',
};

export const PICKUP_BAG_SLOT_REMINDER = '取回前请留出至少一个背包空位，避免白跑一趟。';

/** 铁匠铺柜台当天是否确认可交易；取回必须落在确认可交易的柜台日。 */
export function isBlacksmithCounterOpen(date: GameDate, states: PlayerStates): boolean {
  return judgeShop('blacksmith', date, states).service.state === 'available';
}

/**
 * 完成日 D+2 或其后的首个柜台可交易日。
 * 完成日本身不顺延；这里只决定最早能去哪天取回。
 *
 * 只保留与日期相关的持久条件（社区中心）：天气与特殊日属于「今天的前提」，
 * 不能外推，否则会把今天的节日或绿雨错误地当成每天如此。
 */
export function earliestPickupDate(
  completesOn: GameDate,
  states: PlayerStates,
  horizonDays = 28,
): GameDate {
  const projected: PlayerStates = { communityCenter: states.communityCenter };
  let candidate = completesOn;
  for (let offset = 0; offset < horizonDays; offset += 1) {
    if (isBlacksmithCounterOpen(candidate, projected)) return candidate;
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

export type ToolUpgradeCheck = { ok: true } | { ok: false; reason: string };

/**
 * 能否完成交付。计划交付本身不改变工具状态；只有标记完成时才检查。
 * 同一时间只允许一件升级中/待取回，且必须有已知的当前等级与下一等级。
 */
export function canDeliverTool(
  pending: PendingToolUpgrade | null,
  tool: ToolKey,
  currentLevel: ToolLevel | undefined,
): ToolUpgradeCheck {
  if (pending) {
    return {
      ok: false,
      reason: `${toolLabel(pending.tool)}正在${TOOL_UPGRADE_PHASE_LABELS.upgrading}或${TOOL_UPGRADE_PHASE_LABELS.ready}，同一时间只能升级一件工具；完成取回前不能再次交付。`,
    };
  }
  if (!currentLevel) {
    return { ok: false, reason: `请先填写${toolLabel(tool)}的当前等级，才能计算目标等级与材料。` };
  }
  if (!nextToolLevel(tool, currentLevel)) {
    return { ok: false, reason: `${toolLabel(tool)}已经是最高等级，没有可升级的目标。` };
  }
  return { ok: true };
}

/** 能否完成取回：必须已有对应工具升级中、已到完成日，且当天柜台确认可交易。 */
export function canPickupTool(
  pending: PendingToolUpgrade | null,
  tool: ToolKey,
  currentDay: GameDate,
  states: PlayerStates,
): ToolUpgradeCheck {
  if (!pending) return { ok: false, reason: '当前没有升级中的工具可供取回。' };
  if (pending.tool !== tool) {
    return { ok: false, reason: `升级中的是${toolLabel(pending.tool)}，不是${toolLabel(tool)}。` };
  }
  if (toolUpgradePhase(pending, currentDay) === 'upgrading') {
    return {
      ok: false,
      reason: `${toolLabel(tool)}要到 ${formatDate(pending.completesOn)} 才完成，暂不能取回。`,
    };
  }
  if (!isBlacksmithCounterOpen(currentDay, states)) {
    return { ok: false, reason: '今天铁匠铺柜台不可交易，无法取回。' };
  }
  return { ok: true };
}
