import type { GameDate } from './date';
import { dateKey, isGameDate } from './date';
import type { GameMinutes } from './time';

/**
 * 活动身份（ADR-0001）。
 * 系统生成的日程活动必须能被稳定识别：重算按身份「存在则更新、不存在则新增」，
 * 绝不先删后建。手工活动独立成项。
 */
export type ActivityIdentity =
  | { kind: 'manual'; id: string }
  | { kind: 'series'; seriesId: string; date: GameDate }
  | { kind: 'care'; batchId: string; date: GameDate; type: CareActivityType };

export type CareActivityType = 'water' | 'harvest' | 'plant';

/**
 * 活动类型：九类内置活动 + 自定义活动。
 * 该字段同时是「系统推荐预留 / 个人默认预留 / 最近一次预留」的键。
 */
export type ActivityType =
  | 'plant'
  | 'water'
  | 'harvest'
  | 'shop'
  | 'toolGive'
  | 'toolTake'
  | 'travel'
  | 'fishing'
  | 'mining'
  | 'custom';

/** 展示顺序：九类内置活动在前，自定义活动在后。 */
export const ACTIVITY_TYPES: readonly ActivityType[] = [
  'plant',
  'water',
  'harvest',
  'shop',
  'toolGive',
  'toolTake',
  'travel',
  'fishing',
  'mining',
  'custom',
];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  plant: '种植',
  water: '浇水',
  harvest: '收获',
  shop: '购物',
  toolGive: '工具升级交付',
  toolTake: '工具取回',
  travel: '赶路',
  fishing: '钓鱼',
  mining: '采矿',
  custom: '自定义活动',
};

export function activityTypeLabel(activityType: ActivityType): string {
  return ACTIVITY_TYPE_LABELS[activityType];
}

export function isActivityType(value: unknown): value is ActivityType {
  return typeof value === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(value);
}

/** 受保护记录：玩家手动改动过，或标记完成。自动重算不得覆盖。 */
export type Protection = {
  editedByPlayer: boolean;
  completed: boolean;
};

/**
 * 当次相关清单：玩家自由填写的条目，不代表系统已核验其价格、库存或购买条件。
 * V1 以纯文本行保存；结构化清单项（名称与数量）留给购物活动专项。
 */
export type Checklist = string[];

/** 把「每行一项」的文本解析成清单；忽略空行，供列表与检查器共用。 */
export function parseChecklist(text: string): Checklist {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * 赶路与钓鱼/采矿的当次补充信息。
 * 工具只用它显示与留档：不估算路线，也不把目标当成产出承诺。
 */
export type ActivityDetails = {
  /** 赶路起点。 */
  from?: string;
  /** 赶路终点。 */
  to?: string;
  /** 钓鱼/采矿地点。 */
  place?: string;
  /** 钓鱼/采矿自由文本目标，不承诺产出。 */
  target?: string;
};

export type Activity = {
  identity: ActivityIdentity;
  activityType: ActivityType;
  name: string;
  start: GameMinutes;
  duration: number;
  protection: Protection;
  /** 当次相关备注，玩家自由填写。 */
  note?: string;
  /** 当次相关清单，玩家自由增删。 */
  checklist?: Checklist;
  /** 赶路起点/终点，或钓鱼与采矿地点/目标。 */
  details?: ActivityDetails;
};

export function manualIdentity(id: string): ActivityIdentity {
  return { kind: 'manual', id };
}

/** 身份的唯一字符串标识，用作列表键与命令寻址。 */
export function identityKey(identity: ActivityIdentity): string {
  switch (identity.kind) {
    case 'manual':
      return `manual:${identity.id}`;
    case 'series':
      return `series:${identity.seriesId}:${dateKey(identity.date)}`;
    case 'care':
      return `care:${identity.batchId}:${dateKey(identity.date)}:${identity.type}`;
  }
}

export function isActivityIdentity(value: unknown): value is ActivityIdentity {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.kind === 'manual') {
    return typeof record.id === 'string' && record.id.length > 0;
  }
  if (record.kind === 'series') {
    return typeof record.seriesId === 'string' && record.seriesId.length > 0 && isGameDate(record.date);
  }
  if (record.kind === 'care') {
    return (
      typeof record.batchId === 'string' &&
      record.batchId.length > 0 &&
      isGameDate(record.date) &&
      (record.type === 'water' || record.type === 'harvest' || record.type === 'plant')
    );
  }
  return false;
}
