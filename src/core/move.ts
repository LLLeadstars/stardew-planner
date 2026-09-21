import type { Activity } from './activity';
import { identityKey } from './activity';
import { sortedActivities } from './schedule';
import { clampStart } from './time';
import type { GameMinutes } from './time';

/**
 * 拖动的落点意图。玩家拖动时只可能落在三个离散位置：
 * 空闲区段起点、某张卡片的上半（紧贴其前）、某张卡片的下半（紧贴其后）。
 */
export type DropTarget =
  | { kind: 'gap'; start: GameMinutes }
  | { kind: 'before'; key: string }
  | { kind: 'after'; key: string };

/**
 * 把落点意图解析成一个开始时刻。连续拖动不会产生中间时刻：
 * 每个落点只对应一个值，且结果被夹在游戏日内（06:00 至次日 01:50）。
 * 目标缺失或指向被拖动活动自身时返回 null。
 */
export function resolveDropStart(
  activities: readonly Activity[],
  moved: Activity,
  target: DropTarget,
): GameMinutes | null {
  if (target.kind === 'gap') return clampStart(target.start);

  const anchor = activities.find((activity) => identityKey(activity.identity) === target.key);
  if (!anchor || identityKey(anchor.identity) === identityKey(moved.identity)) return null;

  const start =
    target.kind === 'before' ? anchor.start - moved.duration : anchor.start + anchor.duration;
  return clampStart(start);
}

export type SwapDirection = 'up' | 'down';

/** 交换开始时刻时产生的补丁：只改开始时刻，不动时长与内容。 */
export type StartPatch = {
  key: string;
  start: GameMinutes;
};

/**
 * 与排序后的相邻项交换开始时刻。列表顺序不是独立状态，
 * 因此「相邻」按开始时刻（同刻按身份）判定，而不是数组顺序。
 * 没有相邻项或身份不存在时返回空数组。
 */
export function swapAdjacentStarts(
  activities: readonly Activity[],
  key: string,
  direction: SwapDirection,
): StartPatch[] {
  const sorted = sortedActivities(activities);
  const index = sorted.findIndex((activity) => identityKey(activity.identity) === key);
  if (index < 0) return [];

  const current = sorted[index]!;
  const neighbor = sorted[direction === 'up' ? index - 1 : index + 1];
  if (!neighbor) return [];

  return [
    { key: identityKey(current.identity), start: neighbor.start },
    { key: identityKey(neighbor.identity), start: current.start },
  ];
}
