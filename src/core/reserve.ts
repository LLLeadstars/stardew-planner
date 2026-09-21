import type { ActivityType } from './activity';
import { clampDuration } from './time';

/**
 * 时长来源。V1 所有活动采用「按时间预留」：
 * 解析优先级为 当前活动手填值 ＞ 个人默认 ＞ 最近一次预留 ＞ 系统推荐预留。
 */
export type DurationSource = 'manual' | 'personal' | 'last' | 'system';

/**
 * 系统推荐预留表（唯一来源）。它是可编辑的规划起点，
 * 不是对活动成果的预测，也不等同于系统估算时长。
 */
export const SYSTEM_RESERVES: Record<ActivityType, number> = {
  custom: 30,
};

export function systemReserve(activityType: ActivityType): number {
  return SYSTEM_RESERVES[activityType];
}

export type ReservePreferences = {
  /** 个人默认预留：玩家显式保存，单次手填不改变它。 */
  personal: Partial<Record<ActivityType, number>>;
  /** 最近一次预留：玩家最近一次为该类活动填写的时长。 */
  last: Partial<Record<ActivityType, number>>;
};

export function emptyReservePreferences(): ReservePreferences {
  return { personal: {}, last: {} };
}

export type ResolvedReserve = {
  minutes: number;
  source: DurationSource;
};

/**
 * 按优先级链解析一次按时间预留。
 * `handwritten` 为当前活动的手填值；缺省或无效时逐级回退，
 * 最终一定落到系统推荐预留。
 */
export function resolveReserve(input: {
  activityType: ActivityType;
  preferences: ReservePreferences;
  handwritten?: number | null;
}): ResolvedReserve {
  const chain: ReadonlyArray<readonly [DurationSource, number | undefined]> = [
    ['manual', input.handwritten ?? undefined],
    ['personal', input.preferences.personal[input.activityType]],
    ['last', input.preferences.last[input.activityType]],
    ['system', systemReserve(input.activityType)],
  ];
  for (const [source, minutes] of chain) {
    if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0) {
      return { minutes: clampDuration(minutes), source };
    }
  }
  return { minutes: clampDuration(systemReserve(input.activityType)), source: 'system' };
}

/** 记录最近一次预留。只改 last，个人默认保持不变。 */
export function withLastReserve(
  preferences: ReservePreferences,
  activityType: ActivityType,
  minutes: number,
): ReservePreferences {
  return {
    ...preferences,
    last: { ...preferences.last, [activityType]: clampDuration(minutes) },
  };
}

/** 玩家显式「保存为个人默认」时才更新。 */
export function withPersonalReserve(
  preferences: ReservePreferences,
  activityType: ActivityType,
  minutes: number,
): ReservePreferences {
  return {
    ...preferences,
    personal: { ...preferences.personal, [activityType]: clampDuration(minutes) },
  };
}
