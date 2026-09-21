import type { Activity, ActivityIdentity, ActivityType } from './activity';
import { identityKey } from './activity';
import type { GameDate } from './date';
import type { ReservePreferences } from './reserve';
import { emptyReservePreferences, resolveReserve, withLastReserve, withPersonalReserve } from './reserve';
import { clampDuration, clampStart } from './time';
import type { GameMinutes } from './time';

export type GameMode = 'single' | 'multi';

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  single: '单人',
  multi: '多人',
};

export type PlannerState = {
  currentDay: GameDate;
  mode: GameMode;
  activities: Activity[];
  reserves: ReservePreferences;
};

export type ActivityPatch = {
  name?: string;
  start?: GameMinutes;
  duration?: number;
};

export type PlannerCommand =
  | {
      kind: 'addActivity';
      identity: ActivityIdentity;
      activityType: ActivityType;
      name: string;
      start: GameMinutes;
      /** 当前活动手填值；省略时按解析链取得时长。 */
      duration?: number;
    }
  | { kind: 'editActivity'; key: string; patch: ActivityPatch }
  | { kind: 'deleteActivity'; key: string }
  | { kind: 'savePersonalReserve'; activityType: ActivityType; minutes: number };

export function createPlannerState(day: GameDate, mode: GameMode): PlannerState {
  return { currentDay: day, mode, activities: [], reserves: emptyReservePreferences() };
}

/**
 * 纯 reducer：只根据状态与命令返回新状态。
 * 新增、删除与改时长只影响目标活动，绝不改变其它活动的开始时刻与时长。
 */
export function reducePlanner(state: PlannerState, command: PlannerCommand): PlannerState {
  switch (command.kind) {
    case 'addActivity': {
      const resolved =
        command.duration === undefined
          ? resolveReserve({ activityType: command.activityType, preferences: state.reserves })
          : { minutes: clampDuration(command.duration) };
      const activity: Activity = {
        identity: command.identity,
        activityType: command.activityType,
        name: command.name,
        start: clampStart(command.start),
        duration: resolved.minutes,
        protection: { editedByPlayer: false, completed: false },
      };
      return {
        ...state,
        activities: [...state.activities, activity],
        reserves:
          command.duration === undefined
            ? state.reserves
            : withLastReserve(state.reserves, command.activityType, resolved.minutes),
      };
    }
    case 'editActivity': {
      const target = state.activities.find(
        (activity) => identityKey(activity.identity) === command.key,
      );
      if (!target) return state;
      return {
        ...state,
        activities: state.activities.map((activity) =>
          identityKey(activity.identity) === command.key ? applyPatch(activity, command.patch) : activity,
        ),
        reserves:
          command.patch.duration === undefined
            ? state.reserves
            : withLastReserve(state.reserves, target.activityType, command.patch.duration),
      };
    }
    case 'deleteActivity': {
      return {
        ...state,
        activities: state.activities.filter(
          (activity) => identityKey(activity.identity) !== command.key,
        ),
      };
    }
    case 'savePersonalReserve': {
      return {
        ...state,
        reserves: withPersonalReserve(state.reserves, command.activityType, command.minutes),
      };
    }
  }
}

function applyPatch(activity: Activity, patch: ActivityPatch): Activity {
  return {
    ...activity,
    name: patch.name ?? activity.name,
    start: patch.start !== undefined ? clampStart(patch.start) : activity.start,
    duration: patch.duration !== undefined ? clampDuration(patch.duration) : activity.duration,
    protection: { ...activity.protection, editedByPlayer: true },
  };
}
