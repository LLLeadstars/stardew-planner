import type { Activity } from './activity';
import { identityKey } from './activity';
import { DAY_END, DAY_START, MINUTE_STEP, endOf, overrunMinutes } from './time';
import type { GameMinutes } from './time';

export type Range = {
  start: GameMinutes;
  end: GameMinutes;
};

/** 空闲时段：游戏日内没有任何活动占用的连续区间。 */
export type Gap = Range & {
  minutes: number;
};

export type Overrun = {
  activity: Activity;
  minutes: number;
};
export type OverlapRelation = 'contains' | 'contained-by' | 'partial';
export type Overlap = { activity: Activity; minutes: number; relation: OverlapRelation };

export function activityRange(activity: Activity): Range {
  return { start: activity.start, end: endOf(activity.start, activity.duration) };
}

export function overlapsOf(activity: Activity, activities: readonly Activity[]): Overlap[] {
  const range = activityRange(activity);
  return sortedActivities(activities).flatMap((other) => {
    if (identityKey(other.identity) === identityKey(activity.identity)) return [];
    const otherRange = activityRange(other);
    const minutes = Math.min(range.end, otherRange.end) - Math.max(range.start, otherRange.start);
    if (minutes <= 0) return [];
    const relation: OverlapRelation = range.start <= otherRange.start && range.end >= otherRange.end
      ? 'contains' : otherRange.start <= range.start && otherRange.end >= range.end ? 'contained-by' : 'partial';
    return [{ activity: other, minutes, relation }];
  });
}

export function conflictGroupKeys(activities: readonly Activity[]): Map<string, number> {
  const sorted = sortedActivities(activities);
  const parent = sorted.map((_, i) => i);
  const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]!));
  for (let i = 0; i < sorted.length; i += 1) for (let j = i + 1; j < sorted.length; j += 1) {
    const a = activityRange(sorted[i]!); const b = activityRange(sorted[j]!);
    if (b.start >= a.end) break;
    if (Math.min(a.end, b.end) > Math.max(a.start, b.start)) parent[find(j)] = find(i);
  }
  const ids = new Map<number, number>(); const result = new Map<string, number>(); let next = 1;
  sorted.forEach((activity, i) => { const root = find(i); if (!ids.has(root)) ids.set(root, next++); result.set(identityKey(activity.identity), ids.get(root)!); });
  return result;
}

/** 按开始时刻排列；列表顺序不是独立状态，同时刻项以身份稳定排序。 */
export function sortedActivities(activities: readonly Activity[]): Activity[] {
  return [...activities].sort(
    (a, b) => a.start - b.start || identityKey(a.identity).localeCompare(identityKey(b.identity)),
  );
}

/**
 * 只有完全没有活动占用的连续区间才算空闲。
 * 活动可以重叠，游标只前进不后退。
 */
export function freeGaps(activities: readonly Activity[]): Gap[] {
  const gaps: Gap[] = [];
  let cursor = DAY_START;
  for (const activity of sortedActivities(activities)) {
    const { start, end } = activityRange(activity);
    if (start > cursor) {
      gaps.push({ start: cursor, end: start, minutes: start - cursor });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < DAY_END) {
    gaps.push({ start: cursor, end: DAY_END, minutes: DAY_END - cursor });
  }
  return gaps.filter((gap) => gap.minutes >= MINUTE_STEP);
}

/** 超出游戏日：结束时刻晚于次日 02:00，保留原安排，只提示超出量。 */
export function overruns(activities: readonly Activity[]): Overrun[] {
  return sortedActivities(activities)
    .map((activity) => ({ activity, minutes: overrunMinutes(activityRange(activity).end) }))
    .filter((entry) => entry.minutes > 0);
}

/** 新活动默认落点：第一个至少放得下 30 分钟的空闲时段起点，否则游戏日开头。 */
export function firstFreeStart(activities: readonly Activity[]): GameMinutes {
  const gap = freeGaps(activities).find((candidate) => candidate.minutes >= 30);
  return gap ? gap.start : DAY_START;
}
