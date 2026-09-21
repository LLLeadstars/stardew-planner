import type { Activity, ActivityDetails, ActivityIdentity, ActivityType, Checklist } from './activity';
import { identityKey } from './activity';
import type { GameDate } from './date';
import type { PlayerStates } from './playerState';
import type { PlayerStateCommand } from './playerState';
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
  /** 按需记录、影响内置信息与提醒的玩家状态与今天前提。 */
  playerStates: PlayerStates;
};

export type ActivityPatch = {
  name?: string;
  start?: GameMinutes;
  duration?: number;
  note?: string;
  checklist?: Checklist;
  details?: ActivityDetails;
};

export type NewActivityFields = {
  activityType: ActivityType;
  name: string;
  /** 当前活动手填值；省略时按解析链取得时长。 */
  duration?: number;
  note?: string;
  checklist?: Checklist;
  details?: ActivityDetails;
};

export type PlannerCommand =
  | ({
      kind: 'addActivity';
      identity: ActivityIdentity;
      start: GameMinutes;
    } & NewActivityFields)
  | { kind: 'editActivity'; key: string; patch: ActivityPatch }
  | { kind: 'toggleActivityCompleted'; key: string; completed?: boolean }
  | { kind: 'deleteActivity'; key: string }
  | { kind: 'savePersonalReserve'; activityType: ActivityType; minutes: number }
  | PlayerStateCommand;

export function createPlannerState(day: GameDate, mode: GameMode): PlannerState {
  return {
    currentDay: day,
    mode,
    activities: [],
    reserves: emptyReservePreferences(),
    playerStates: {},
  };
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
        ...carriedFields(command),
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
    case 'toggleActivityCompleted': {
      return {
        ...state,
        activities: state.activities.map((activity) => {
          if (identityKey(activity.identity) !== command.key) return activity;
          const completed = command.completed ?? !activity.protection.completed;
          return { ...activity, protection: { ...activity.protection, completed } };
        }),
      };
    }
    case 'savePersonalReserve': {
      return {
        ...state,
        reserves: withPersonalReserve(state.reserves, command.activityType, command.minutes),
      };
    }
    case 'setWeather':
      return withPlayerStates(state, setStateValue(state.playerStates, 'weather', command.value));
    case 'setSpecialDay':
      return withPlayerStates(state, setStateValue(state.playerStates, 'specialDay', command.value));
    case 'setCommunityCenter':
      return withPlayerStates(
        state,
        setStateValue(state.playerStates, 'communityCenter', command.value),
      );
    case 'setTownKey':
      return withPlayerStates(state, setStateValue(state.playerStates, 'townKey', command.value));
    case 'setToolLevel': {
      const toolLevels = { ...state.playerStates.toolLevels };
      if (command.level === undefined) delete toolLevels[command.tool];
      else toolLevels[command.tool] = command.level;
      return withPlayerStates(state, { ...state.playerStates, toolLevels });
    }
  }
}

function withPlayerStates(state: PlannerState, playerStates: PlayerStates): PlannerState {
  return { ...state, playerStates };
}

/** 写入或清空一个玩家状态；清空时不留下值为 undefined 的键。 */
function setStateValue<K extends keyof PlayerStates>(
  states: PlayerStates,
  key: K,
  value: PlayerStates[K],
): PlayerStates {
  const next: PlayerStates = { ...states };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

function applyPatch(activity: Activity, patch: ActivityPatch): Activity {
  return {
    ...activity,
    name: patch.name ?? activity.name,
    start: patch.start !== undefined ? clampStart(patch.start) : activity.start,
    duration: patch.duration !== undefined ? clampDuration(patch.duration) : activity.duration,
    note: patch.note ?? activity.note,
    checklist: patch.checklist ?? activity.checklist,
    details: patch.details ?? activity.details,
    protection: { ...activity.protection, editedByPlayer: true },
  };
}

/** 只带上玩家真的填了的当次信息，避免在存档里留下空字段。 */
function carriedFields(fields: NewActivityFields): Pick<Activity, 'note' | 'checklist' | 'details'> {
  const carried: Pick<Activity, 'note' | 'checklist' | 'details'> = {};
  if (fields.note) carried.note = fields.note;
  if (fields.checklist && fields.checklist.length) carried.checklist = fields.checklist;
  if (fields.details && Object.keys(fields.details).length) carried.details = fields.details;
  return carried;
}
