/**
 * 游戏内时间：以 10 游戏分钟为最小单位。
 *
 * 绝对分钟以当日 00:00 为 0：
 *   06:00 = 360（游戏日开始）
 *   次日 02:00 = 1560（游戏日结束）
 * 午夜之后的时刻（>= 1440）在显示时加「次日」前缀。
 */

export const MINUTE_STEP = 10;

/** 绝对游戏分钟：当日 00:00 = 0。 */
export type GameMinutes = number;

/** 06:00 */
export const DAY_START = 6 * 60;
/** 次日 02:00 */
export const DAY_END = 26 * 60;
/** 可作为开始时刻的最晚值：次日 01:50。次日 02:00 只能作为结束时刻。 */
export const LAST_START = DAY_END - MINUTE_STEP;

export function snapToStep(minutes: number): number {
  return Math.round(minutes / MINUTE_STEP) * MINUTE_STEP;
}

/** 开始时刻必须落在游戏日内且符合 10 分钟粒度。 */
export function clampStart(minutes: number): number {
  return Math.min(LAST_START, Math.max(DAY_START, snapToStep(minutes)));
}

/** 时长必须符合 10 分钟粒度且至少 10 分钟。 */
export function clampDuration(minutes: number): number {
  return Math.max(MINUTE_STEP, snapToStep(minutes));
}

export function endOf(start: number, duration: number): number {
  return start + duration;
}

/** 结束时刻晚于次日 02:00 时返回超出分钟数，否则为 0。 */
export function overrunMinutes(end: number): number {
  return Math.max(0, end - DAY_END);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** 以游戏时钟显示时刻；午夜之后加「次日」，绝不显示 24:xx。 */
export function formatTime(minutes: number): string {
  const nextDay = minutes >= 1440;
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${nextDay ? '次日 ' : ''}${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours} 小时 ${rest} 分钟`;
  if (hours) return `${hours} 小时`;
  return `${rest} 分钟`;
}
