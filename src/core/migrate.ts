import type { Activity, ActivityIdentity, Protection } from './activity';
import type { GameDate } from './date';
import type { GameMode, PlannerState } from './planner';
import { emptyReservePreferences } from './reserve';
import { isActivity, isPlannerState } from './validate';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 已知旧格式的迁移入口。
 * v1 没有活动类型与预留偏好，且当时只能创建自定义活动；
 * v2 已有活动类型与预留偏好，但还没有备注、清单与当次信息。
 * 迁移后仍走一次当前版本的完整校验，避免把半成品状态放进来。
 */
export function migrateState(version: number, state: unknown): PlannerState | null {
  if (version === 1) return migrateV1(state);
  if (version === 2) return isPlannerState(state) ? state : null;
  return null;
}

function migrateV1(state: unknown): PlannerState | null {
  if (!isRecord(state) || !Array.isArray(state.activities)) return null;

  const activities: Activity[] = [];
  for (const raw of state.activities) {
    if (!isRecord(raw)) return null;
    const candidate: Activity = {
      identity: raw.identity as ActivityIdentity,
      activityType: 'custom',
      name: raw.name as string,
      start: raw.start as number,
      duration: raw.duration as number,
      protection: raw.protection as Protection,
    };
    if (!isActivity(candidate)) return null;
    activities.push(candidate);
  }

  const migrated: PlannerState = {
    currentDay: state.currentDay as GameDate,
    mode: state.mode as GameMode,
    activities,
    reserves: emptyReservePreferences(),
  };
  return isPlannerState(migrated) ? migrated : null;
}
