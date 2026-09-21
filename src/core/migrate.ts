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
 * v2 已有活动类型与预留偏好，但还没有备注、清单与当次信息；
 * v3 已有当次信息，但还没有玩家状态与今天前提；
 * v4 已有玩家状态，但购物活动还没有门店与购物清单项；
 * v5 已有购物门店与购物清单项，但还没有工具升级状态。
 * 迁移后仍走一次当前版本的完整校验，避免把半成品状态放进来。
 */
export function migrateState(version: number, state: unknown): PlannerState | null {
  if (version === 1) return migrateV1(state);
  if (version === 2 || version === 3 || version === 4 || version === 5) {
    return withUpgradeDefaults(state);
  }
  return null;
}

/** v2～v5 都缺后续版本才引入的可选字段；补齐 playerStates 与 toolUpgrade 后再走当前校验。 */
function withUpgradeDefaults(state: unknown): PlannerState | null {
  if (!isRecord(state)) return null;
  const candidate = {
    ...state,
    playerStates: isRecord(state.playerStates) ? state.playerStates : {},
    toolUpgrade: state.toolUpgrade === undefined ? null : state.toolUpgrade,
  };
  return isPlannerState(candidate) ? candidate : null;
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
    playerStates: {},
    toolUpgrade: null,
  };
  return isPlannerState(migrated) ? migrated : null;
}
