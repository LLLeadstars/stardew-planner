export type Season = 0 | 1 | 2 | 3;

export const SEASONS: readonly Season[] = [0, 1, 2, 3];
export const SEASON_NAMES = ['春', '夏', '秋', '冬'] as const;
export const DAYS_PER_SEASON = 28;

export type GameDate = {
  year: number;
  season: Season;
  day: number;
};

/** 稳定、可比较、可用于存档键的日期标识：`年-季-日`。 */
export function dateKey(date: GameDate): string {
  return `${date.year}-${date.season}-${date.day}`;
}

export function isGameDate(value: unknown): value is GameDate {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    Number.isInteger(record.year) &&
    (record.year as number) >= 1 &&
    (record.season === 0 || record.season === 1 || record.season === 2 || record.season === 3) &&
    Number.isInteger(record.day) &&
    (record.day as number) >= 1 &&
    (record.day as number) <= DAYS_PER_SEASON
  );
}

export function formatDate(date: GameDate): string {
  return `第 ${date.year} 年 ${SEASON_NAMES[date.season]} ${date.day} 日`;
}

/** 星期：春 1 日为周一，每季 28 天恰好四周，因此星期只由「季 + 日」决定。 */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: '周一',
  tue: '周二',
  wed: '周三',
  thu: '周四',
  fri: '周五',
  sat: '周六',
  sun: '周日',
};

export function weekdayOf(date: GameDate): Weekday {
  const index = (date.season * DAYS_PER_SEASON + (date.day - 1)) % WEEKDAYS.length;
  return WEEKDAYS[index]!;
}
