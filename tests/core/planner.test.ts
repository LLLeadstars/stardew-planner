import { describe, expect, it } from 'vitest';
import {
  DAY_END,
  LAST_START,
  createPlannerState,
  identityKey,
  manualIdentity,
  reducePlanner,
} from '../../src/core';
import type { PlannerState } from '../../src/core';

const day = { year: 1, season: 0, day: 3 } as const;

function withManual(state: PlannerState, id: string, start: number, duration: number): PlannerState {
  return reducePlanner(state, {
    kind: 'addActivity',
    identity: manualIdentity(id),
    name: `活动 ${id}`,
    start,
    duration,
  });
}

describe('日程 reducer', () => {
  it('创建初始状态：当前游戏日、模式与空活动表', () => {
    const state = createPlannerState(day, 'single');
    expect(state).toEqual({ currentDay: day, mode: 'single', activities: [] });
  });

  it('新活动带身份与未受保护的初始标记', () => {
    const state = withManual(createPlannerState(day, 'single'), 'a', 360, 60);
    expect(state.activities).toHaveLength(1);
    expect(state.activities[0]?.identity).toEqual({ kind: 'manual', id: 'a' });
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

  it('身份标识区分手工活动、系列实例与照料活动', () => {
    expect(identityKey(manualIdentity('x'))).toBe('manual:x');
    expect(identityKey({ kind: 'series', seriesId: 's1', date: day })).toBe('series:s1:1-0-3');
    expect(identityKey({ kind: 'care', batchId: 'b1', date: day, type: 'water' })).toBe('care:b1:1-0-3:water');
  });
});
