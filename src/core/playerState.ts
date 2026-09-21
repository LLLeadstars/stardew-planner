import type { Activity, ActivityType } from './activity';
import { shopConditionKeys } from './shop';

/** 天气：普通雨与绿雨分开，未填写时相关判断保持未知。 */
export const WEATHER_OPTIONS = [
  { value: 'sunny', label: '晴朗' },
  { value: 'rain', label: '下雨' },
  { value: 'greenRain', label: '绿雨' },
] as const;
export type Weather = (typeof WEATHER_OPTIONS)[number]['value'];

/** 特殊日：节日会改变门店与柜台条件。 */
export const SPECIAL_DAY_OPTIONS = [
  { value: 'none', label: '无' },
  { value: 'festival', label: '节日' },
] as const;
export type SpecialDay = (typeof SPECIAL_DAY_OPTIONS)[number]['value'];

/** 社区中心状态：影响皮埃尔杂货店周三等条件性营业判断。 */
export const COMMUNITY_CENTER_OPTIONS = [
  { value: 'restored', label: '已修复' },
  { value: 'notRestored', label: '未修复' },
] as const;
export type CommunityCenterStatus = (typeof COMMUNITY_CENTER_OPTIONS)[number]['value'];

/** 城镇钥匙：影响进门条件，不改变服务时段。 */
export const TOWN_KEY_OPTIONS = [
  { value: 'yes', label: '持有' },
  { value: 'no', label: '未持有' },
] as const;
export type TownKeyStatus = (typeof TOWN_KEY_OPTIONS)[number]['value'];

/** 罗宾施工状态：施工期间木匠商店全天关闭，柜台技巧也不成立。 */
export const ROBIN_WORKING_OPTIONS = [
  { value: 'yes', label: '正在农场施工' },
  { value: 'no', label: '没有施工' },
] as const;
export type RobinWorkingStatus = (typeof ROBIN_WORKING_OPTIONS)[number]['value'];

/** 可升级工具（铁匠铺支持的链条）。 */
export const TOOL_OPTIONS = [
  { value: 'axe', label: '斧头' },
  { value: 'pickaxe', label: '十字镐' },
  { value: 'hoe', label: '锄头' },
  { value: 'can', label: '喷壶' },
  { value: 'pan', label: '淘盘' },
  { value: 'trash', label: '垃圾桶' },
] as const;
export type ToolKey = (typeof TOOL_OPTIONS)[number]['value'];

export const TOOL_LEVEL_OPTIONS = [
  { value: 'basic', label: '基础' },
  { value: 'copper', label: '铜' },
  { value: 'steel', label: '钢' },
  { value: 'gold', label: '金' },
  { value: 'iridium', label: '铱' },
] as const;
export type ToolLevel = (typeof TOOL_LEVEL_OPTIONS)[number]['value'];

export type ToolLevels = Partial<Record<ToolKey, ToolLevel>>;

/**
 * 玩家按需记录、会影响内置信息与提醒的游戏事实。
 * 字段缺省表示「尚未填写」，相关判断保持未知；首次使用不要求填写任何一项。
 */
export type PlayerStates = {
  weather?: Weather;
  specialDay?: SpecialDay;
  communityCenter?: CommunityCenterStatus;
  townKey?: TownKeyStatus;
  robinWorking?: RobinWorkingStatus;
  toolLevels?: ToolLevels;
};

/** 会被活动依赖、需要渐进收集的玩家状态；天气与特殊日属于「今天的前提」。 */
export type PlayerStateKey = 'communityCenter' | 'townKey' | 'robinWorking' | 'toolLevels';

export const STATE_LABELS: Record<PlayerStateKey, string> = {
  communityCenter: '社区中心状态',
  townKey: '城镇钥匙',
  robinWorking: '罗宾施工状态',
  toolLevels: '工具等级',
};

const UNKNOWN_LABEL = '未填写';

/**
 * 活动类型到玩家状态的依赖注册表。
 * 左栏只显示本日活动真正依赖的状态；购物活动再按所选门店细分。
 */
const ACTIVITY_STATE_DEPENDENCIES: Record<ActivityType, readonly PlayerStateKey[]> = {
  plant: [],
  water: [],
  harvest: [],
  shop: [],
  toolGive: ['toolLevels'],
  toolTake: ['toolLevels'],
  travel: [],
  fishing: [],
  mining: [],
  custom: [],
};

/** 单个活动依赖的玩家状态。 */
export function activityStateKeys(activity: Activity): PlayerStateKey[] {
  if (activity.activityType === 'shop') return shopConditionKeys(activity.details?.shop);
  return [...ACTIVITY_STATE_DEPENDENCIES[activity.activityType]];
}

/** 本日全部活动依赖的玩家状态，按注册表顺序去重。 */
export function requiredStateKeys(activities: readonly Activity[]): PlayerStateKey[] {
  const keys: PlayerStateKey[] = [];
  for (const activity of activities) {
    for (const key of activityStateKeys(activity)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

function optionLabel<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** 状态当前取值的展示文本；未填写时统一显示「未填写」。 */
export function stateValueLabel(key: PlayerStateKey, states: PlayerStates): string {
  switch (key) {
    case 'communityCenter':
      return states.communityCenter
        ? optionLabel(COMMUNITY_CENTER_OPTIONS, states.communityCenter)
        : UNKNOWN_LABEL;
    case 'townKey':
      return states.townKey ? optionLabel(TOWN_KEY_OPTIONS, states.townKey) : UNKNOWN_LABEL;
    case 'robinWorking':
      return states.robinWorking ? optionLabel(ROBIN_WORKING_OPTIONS, states.robinWorking) : UNKNOWN_LABEL;
    case 'toolLevels': {
      const levels = states.toolLevels ?? {};
      const parts = TOOL_OPTIONS.filter((tool) => levels[tool.value] !== undefined).map(
        (tool) => `${tool.label} ${optionLabel(TOOL_LEVEL_OPTIONS, levels[tool.value]!)}`,
      );
      return parts.length ? parts.join('、') : UNKNOWN_LABEL;
    }
  }
}

/**
 * 该状态此刻对当前判断的影响，一句话、面向玩家。
 * 只说明它影响哪类判断与当前取值，不下结论；具体判定由门店／工具切片给出。
 */
export function describeStateImpact(
  key: PlayerStateKey,
  states: PlayerStates,
  activities: readonly Activity[],
): string {
  const count = activities.filter((activity) => activityStateKeys(activity).includes(key)).length;
  const current = stateValueLabel(key, states);
  switch (key) {
    case 'communityCenter':
      return `影响皮埃尔杂货店周三等门店的营业判断；本日 ${count} 项活动依赖。当前：${current}。`;
    case 'townKey':
      return `影响门店进门条件，不改变服务时段；本日 ${count} 项活动依赖。当前：${current}。`;
    case 'robinWorking':
      return `施工期间木匠商店全天关闭；本日 ${count} 项活动依赖。当前：${current}。`;
    case 'toolLevels':
      return `影响交付与取回的目标等级、材料与费用；本日 ${count} 项活动依赖。当前：${current}。`;
  }
}

/** 左栏「影响本日的玩家状态」一行。 */
export type LeftStateRow = {
  key: PlayerStateKey;
  label: string;
  valueLabel: string;
  impact: string;
};

export function requiredStateRows(
  activities: readonly Activity[],
  states: PlayerStates,
): LeftStateRow[] {
  return requiredStateKeys(activities).map((key) => ({
    key,
    label: STATE_LABELS[key],
    valueLabel: stateValueLabel(key, states),
    impact: describeStateImpact(key, states, activities),
  }));
}

/** 活动卡片上的一行状态摘要；该活动不依赖玩家状态时返回 null。 */
export function activityStateSummary(activity: Activity, states: PlayerStates): string | null {
  const keys = activityStateKeys(activity);
  if (!keys.length) return null;
  return keys.map((key) => `${STATE_LABELS[key]}：${stateValueLabel(key, states)}`).join(' · ');
}

/** 就地修改玩家状态或今天前提的动作；天气与特殊日清空表示「未填写」。 */
export type PlayerStateCommand =
  | { kind: 'setWeather'; value?: Weather }
  | { kind: 'setSpecialDay'; value?: SpecialDay }
  | { kind: 'setCommunityCenter'; value?: CommunityCenterStatus }
  | { kind: 'setTownKey'; value?: TownKeyStatus }
  | { kind: 'setRobinWorking'; value?: RobinWorkingStatus }
  | { kind: 'setToolLevel'; tool: ToolKey; level?: ToolLevel };
