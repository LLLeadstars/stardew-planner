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
 * 活动类型。V1 先只有自定义活动；内置活动类型由 #18 扩展。
 * 该字段同时是「系统推荐预留 / 个人默认预留 / 最近一次预留」的键。
 */
export type ActivityType = 'custom';

const ACTIVITY_TYPES: readonly ActivityType[] = ['custom'];

export function isActivityType(value: unknown): value is ActivityType {
  return typeof value === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(value);
}

/** 受保护记录：玩家手动改动过，或标记完成。自动重算不得覆盖。 */
export type Protection = {
  editedByPlayer: boolean;
  completed: boolean;
};

export type Activity = {
  identity: ActivityIdentity;
  activityType: ActivityType;
  name: string;
  start: GameMinutes;
  duration: number;
  protection: Protection;
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
