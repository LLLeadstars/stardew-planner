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

export function activityRange(activity: Activity): Range {
  return { start: activity.start, end: endOf(activity.start, activity.duration) };
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
