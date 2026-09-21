import type { Activity, ActivityIdentity } from './activity';
import { identityKey } from './activity';
import type { GameDate } from './date';
import { clampDuration, clampStart } from './time';
import type { GameMinutes } from './time';

export type GameMode = 'single' | 'multi';

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  single: '单人',
  multi: '多人',
};

/** 自定义活动的系统推荐预留。内置活动的推荐预留表在后续切片引入。 */
export const DEFAULT_CUSTOM_DURATION = 30;

export type PlannerState = {
  currentDay: GameDate;
  mode: GameMode;
  activities: Activity[];
};

export type ActivityPatch = {
  name?: string;
  start?: GameMinutes;
  duration?: number;
};

export type PlannerCommand =
  | { kind: 'addActivity'; identity: ActivityIdentity; name: string; start: GameMinutes; duration: number }
  | { kind: 'editActivity'; key: string; patch: ActivityPatch }
  | { kind: 'deleteActivity'; key: string };

export function createPlannerState(day: GameDate, mode: GameMode): PlannerState {
  return { currentDay: day, mode, activities: [] };
}

/**
 * 纯 reducer：只根据状态与命令返回新状态。
 * 新增与删除只影响目标活动，绝不改变其它活动的开始时刻与时长。
 */
export function reducePlanner(state: PlannerState, command: PlannerCommand): PlannerState {
  switch (command.kind) {
    case 'addActivity': {
      const activity: Activity = {
        identity: command.identity,
        name: command.name,
        start: clampStart(command.start),
        duration: clampDuration(command.duration),
        protection: { editedByPlayer: false, completed: false },
      };
      return { ...state, activities: [...state.activities, activity] };
    }
    case 'editActivity': {
      return {
        ...state,
        activities: state.activities.map((activity) => {
          if (identityKey(activity.identity) !== command.key) return activity;
          return applyPatch(activity, command.patch);
        }),
      };
    }
    case 'deleteActivity': {
      return {
        ...state,
        activities: state.activities.filter((activity) => identityKey(activity.identity) !== command.key),
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
