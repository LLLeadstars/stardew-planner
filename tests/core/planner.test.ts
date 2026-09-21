import { describe, expect, it } from 'vitest';
import {
  DAY_END,
  LAST_START,
  createPlannerState,
  identityKey,
  manualIdentity,
  reducePlanner,
  systemReserve,
} from '../../src/core';
import type { PlannerState } from '../../src/core';

const day = { year: 1, season: 0, day: 3 } as const;

function withManual(
  state: PlannerState,
  id: string,
  start: number,
  duration?: number,
): PlannerState {
  return reducePlanner(state, {
    kind: 'addActivity',
    identity: manualIdentity(id),
    activityType: 'custom',
    name: `活动 ${id}`,
    start,
    duration,
  });
}

describe('日程 reducer', () => {
  it('创建初始状态：当前游戏日、模式与空活动表', () => {
    const state = createPlannerState(day, 'single');
    expect(state).toEqual({
      currentDay: day,
      mode: 'single',
      activities: [],
      reserves: { personal: {}, last: {} },
    });
  });

  it('新活动带身份、活动类型与未受保护的初始标记', () => {
    const state = withManual(createPlannerState(day, 'single'), 'a', 360, 60);
    expect(state.activities).toHaveLength(1);
    expect(state.activities[0]?.identity).toEqual({ kind: 'manual', id: 'a' });
    expect(state.activities[0]?.activityType).toBe('custom');
    expect(state.activities[0]?.protection).toEqual({ editedByPlayer: false, completed: false });
  });

  it('添加活动不影响其它活动的开始时刻与时长', () => {
    let state = withManual(createPlannerState(day, 'single'), 'a', 360, 60);
    const before = state.activities[0];
    state = withManual(state, 'b', 600, 90);
    expect(state.activities[0]).toEqual(before);
    expect(state.activities[1]?.start).toBe(600);
  });

  it('删除活动只移除目标，不影响其它活动', () => {
    let state = withManual(createPlannerState(day, 'single'), 'a', 360, 60);
    state = withManual(state, 'b', 600, 90);
    state = withManual(state, 'c', 900, 30);
    const b = state.activities[1];
    state = reducePlanner(state, { kind: 'deleteActivity', key: identityKey(manualIdentity('b')) });
    expect(state.activities.map((a) => identityKey(a.identity))).toEqual([
      identityKey(manualIdentity('a')),
      identityKey(manualIdentity('c')),
    ]);
    expect(state.activities.find((a) => identityKey(a.identity) === identityKey(manualIdentity('c')))).not.toEqual(b);
    expect(state.activities.find((a) => identityKey(a.identity) === identityKey(manualIdentity('b')))).toBeUndefined();
  });

  it('添加时开始时刻被夹在游戏日内，时长遵守粒度', () => {
    let state = withManual(createPlannerState(day, 'single'), 'late', DAY_END + 500, 33);
    const activity = state.activities[0];
    expect(activity?.start).toBe(LAST_START);
    expect(activity?.duration).toBe(30);
  });

  it('编辑活动遵守同一套时间规则并标记为受保护记录', () => {
    let state = withManual(createPlannerState(day, 'single'), 'a', 360, 60);
    state = reducePlanner(state, {
      kind: 'editActivity',
      key: identityKey(manualIdentity('a')),
      patch: { start: 33, duration: 155 },
    });
    const activity = state.activities[0];
    expect(activity?.start).toBe(360);
    expect(activity?.duration).toBe(160);
    expect(activity?.protection.editedByPlayer).toBe(true);
  });

  it('编辑只作用于目标身份', () => {
    let state = withManual(createPlannerState(day, 'single'), 'a', 360, 60);
    state = withManual(state, 'b', 600, 60);
    state = reducePlanner(state, {
      kind: 'editActivity',
      key: identityKey(manualIdentity('b')),
      patch: { duration: 120 },
    });
    expect(state.activities[0]?.duration).toBe(60);
    expect(state.activities[1]?.duration).toBe(120);
  });

  it('切换完成状态只作用于目标活动并保留手动编辑标记', () => {
    let state = withManual(createPlannerState(day, 'single'), 'a', 360, 60);
    state = withManual(state, 'b', 600, 60);
    state = reducePlanner(state, { kind: 'toggleActivityCompleted', key: identityKey(manualIdentity('a')), completed: true });
    expect(state.activities[0]?.protection.completed).toBe(true);
    expect(state.activities[1]?.protection.completed).toBe(false);
    expect(state.activities[0]?.protection.editedByPlayer).toBe(false);
    state = reducePlanner(state, { kind: 'toggleActivityCompleted', key: identityKey(manualIdentity('a')) });
    expect(state.activities[0]?.protection.completed).toBe(false);
  });

  it('创建新活动时按解析链取得时长：系统推荐预留', () => {
    const state = withManual(createPlannerState(day, 'single'), 'a', 360);
    expect(state.activities[0]?.duration).toBe(systemReserve('custom'));
  });

  it('添加时提供手填值就采用该值，并记为最近一次预留', () => {
    const state = withManual(createPlannerState(day, 'single'), 'a', 360, 40);
    expect(state.activities[0]?.duration).toBe(40);
    expect(state.reserves.last.custom).toBe(40);
    expect(state.reserves.personal.custom).toBeUndefined();
  });

  it('编辑时长只改目标活动、更新最近一次预留，不动个人默认', () => {
    let state = withManual(createPlannerState(day, 'single'), 'a', 360, 60);
    state = withManual(state, 'b', 600, 60);
    state = reducePlanner(state, {
      kind: 'editActivity',
      key: identityKey(manualIdentity('a')),
      patch: { duration: 90 },
    });
    expect(state.activities[0]?.duration).toBe(90);
    expect(state.activities[1]?.duration).toBe(60);
    expect(state.activities[1]?.start).toBe(600);
    expect(state.reserves.last.custom).toBe(90);
    expect(state.reserves.personal.custom).toBeUndefined();
  });

  it('显式保存个人默认后，同类新活动预填该值', () => {
    let state = withManual(createPlannerState(day, 'single'), 'a', 360, 40);
    state = reducePlanner(state, { kind: 'savePersonalReserve', activityType: 'custom', minutes: 90 });
    expect(state.reserves.personal.custom).toBe(90);
    // 单次手填值 40（最近一次预留）不覆盖个人默认 90
    state = withManual(state, 'b', 600);
    expect(state.activities[1]?.duration).toBe(90);
  });

  it('同一开始时刻的多个活动全部保留', () => {
    let state = withManual(createPlannerState(day, 'single'), 'a', 360, 60);
    state = withManual(state, 'b', 360, 30);
    expect(state.activities).toHaveLength(2);
    expect(state.activities.map((activity) => activity.start)).toEqual([360, 360]);
  });

  it('身份标识区分手工活动、系列实例与照料活动', () => {
    expect(identityKey(manualIdentity('x'))).toBe('manual:x');
    expect(identityKey({ kind: 'series', seriesId: 's1', date: day })).toBe('series:s1:1-0-3');
    expect(identityKey({ kind: 'care', batchId: 'b1', date: day, type: 'water' })).toBe('care:b1:1-0-3:water');
  });
});
