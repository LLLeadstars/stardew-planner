import { describe, expect, it } from 'vitest';
import {
  DAY_END,
  LAST_START,
  addDays,
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
  it('创建初始状态：当前游戏日、模式、空活动表与空玩家状态', () => {
    const state = createPlannerState(day, 'single');
    expect(state).toEqual({
      currentDay: day,
      mode: 'single',
      activities: [],
      cropBatches: [],
      reserves: { personal: {}, last: {} },
      playerStates: {},
      toolUpgrade: null,
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

  it('内置活动按活动类型取得系统推荐预留，并保存备注、清单与当次信息', () => {
    const state = reducePlanner(createPlannerState(day, 'single'), {
      kind: 'addActivity',
      identity: manualIdentity('t'),
      activityType: 'travel',
      name: '赶路：农场 → 铁匠铺',
      start: 360,
      note: '带 5 个铜矿',
      checklist: ['铜矿 ×5', '铁锭 ×1'],
      details: { from: '农场', to: '铁匠铺' },
    });
    const activity = state.activities[0];
    expect(activity?.activityType).toBe('travel');
    expect(activity?.duration).toBe(systemReserve('travel'));
    expect(activity?.note).toBe('带 5 个铜矿');
    expect(activity?.checklist).toEqual(['铜矿 ×5', '铁锭 ×1']);
    expect(activity?.details).toEqual({ from: '农场', to: '铁匠铺' });
  });

  it('内置活动的手填时长短写为最近一次预留，按活动类型分别记录', () => {
    let state = reducePlanner(createPlannerState(day, 'single'), {
      kind: 'addActivity',
      identity: manualIdentity('f'),
      activityType: 'fishing',
      name: '钓鱼',
      start: 360,
      duration: 90,
    });
    expect(state.reserves.last.fishing).toBe(90);
    expect(state.reserves.last.travel).toBeUndefined();
    state = reducePlanner(state, {
      kind: 'addActivity',
      identity: manualIdentity('m'),
      activityType: 'mining',
      name: '采矿',
      start: 600,
    });
    expect(state.activities[1]?.duration).toBe(systemReserve('mining'));
  });

  it('编辑可更新备注、清单与当次信息，并记为受保护记录', () => {
    let state = reducePlanner(createPlannerState(day, 'single'), {
      kind: 'addActivity',
      identity: manualIdentity('t'),
      activityType: 'travel',
      name: '赶路',
      start: 360,
    });
    state = reducePlanner(state, {
      kind: 'editActivity',
      key: identityKey(manualIdentity('t')),
      patch: { note: '改走山路', checklist: ['回复体力'], details: { from: '农场', to: '山上' } },
    });
    const activity = state.activities[0];
    expect(activity?.note).toBe('改走山路');
    expect(activity?.checklist).toEqual(['回复体力']);
    expect(activity?.details).toEqual({ from: '农场', to: '山上' });
    expect(activity?.protection.editedByPlayer).toBe(true);
  });

  it('身份标识区分手工活动、系列实例与照料活动', () => {
    expect(identityKey(manualIdentity('x'))).toBe('manual:x');
    expect(identityKey({ kind: 'series', seriesId: 's1', date: day })).toBe('series:s1:1-0-3');
    expect(identityKey({ kind: 'care', batchId: 'b1', date: day, type: 'water' })).toBe('care:b1:1-0-3:water');
  });
});

describe('工具升级 reducer：交付、取回与一次性', () => {
  function give(state: PlannerState, id: string, tool: 'axe' | 'pickaxe', start = 600): PlannerState {
    return reducePlanner(state, {
      kind: 'addActivity',
      identity: manualIdentity(id),
      activityType: 'toolGive',
      name: `交付 ${tool}`,
      start,
      details: { tool },
    });
  }

  function take(state: PlannerState, id: string, tool: 'axe'): PlannerState {
    return reducePlanner(state, {
      kind: 'addActivity',
      identity: manualIdentity(id),
      activityType: 'toolTake',
      name: `取回 ${tool}`,
      start: 700,
      details: { tool },
    });
  }

  function toggle(state: PlannerState, id: string, completed?: boolean): PlannerState {
    return reducePlanner(state, {
      kind: 'toggleActivityCompleted',
      key: identityKey(manualIdentity(id)),
      completed,
    });
  }

  it('只计划交付但未标记完成时，工具状态不变', () => {
    let state = createPlannerState(day, 'single');
    state = reducePlanner(state, { kind: 'setToolLevel', tool: 'axe', level: 'copper' });
    state = give(state, 'give', 'axe');
    expect(state.toolUpgrade).toBeNull();
    expect(state.activities).toHaveLength(1);
  });

  it('完成交付后进入升级中，给出 D+2 完成日，且后台等待不产生任何日程活动', () => {
    let state = createPlannerState(day, 'single');
    state = reducePlanner(state, { kind: 'setToolLevel', tool: 'axe', level: 'copper' });
    state = give(state, 'give', 'axe');
    const before = state.activities.length;
    state = toggle(state, 'give', true);
    expect(state.toolUpgrade).toMatchObject({
      tool: 'axe',
      fromLevel: 'copper',
      targetLevel: 'steel',
      deliveredOn: day,
      completesOn: addDays(day, 2),
    });
    expect(state.activities).toHaveLength(before);
    expect(state.activities[0]?.protection.completed).toBe(true);
  });

  it('当前等级未知时不进入升级中，交付保持未完成', () => {
    let state = give(createPlannerState(day, 'single'), 'give', 'axe');
    state = toggle(state, 'give', true);
    expect(state.toolUpgrade).toBeNull();
    expect(state.activities[0]?.protection.completed).toBe(false);
  });

  it('上一件完成取回前再次发起交付被拒绝，第二项保持未完成', () => {
    let state = createPlannerState(day, 'single');
    state = reducePlanner(state, { kind: 'setToolLevel', tool: 'axe', level: 'copper' });
    state = give(state, 'give1', 'axe');
    state = toggle(state, 'give1', true);
    state = give(state, 'give2', 'pickaxe', 700);
    state = toggle(state, 'give2', true);
    expect(state.toolUpgrade?.tool).toBe('axe');
    expect(
      state.activities.find(
        (activity) => identityKey(activity.identity) === identityKey(manualIdentity('give2')),
      )?.protection.completed,
    ).toBe(false);
  });

  it('完成取回后工具等级更新、升级记录清空，且不新增日程活动', () => {
    let state = createPlannerState(day, 'single');
    state = reducePlanner(state, { kind: 'setToolLevel', tool: 'axe', level: 'copper' });
    state = reducePlanner(state, { kind: 'setCommunityCenter', value: 'notRestored' });
    state = give(state, 'give', 'axe');
    state = toggle(state, 'give', true);
    state = { ...state, currentDay: addDays(day, 2) };
    state = take(state, 'take', 'axe');
    const before = state.activities.length;
    state = toggle(state, 'take', true);
    expect(state.playerStates.toolLevels?.axe).toBe('steel');
    expect(state.toolUpgrade).toBeNull();
    expect(state.activities).toHaveLength(before);
  });

  it('未到完成日就标记取回会被拒绝', () => {
    let state = createPlannerState(day, 'single');
    state = reducePlanner(state, { kind: 'setToolLevel', tool: 'axe', level: 'copper' });
    state = give(state, 'give', 'axe');
    state = toggle(state, 'give', true);
    state = take(state, 'take', 'axe');
    state = toggle(state, 'take', true);
    expect(state.toolUpgrade?.tool).toBe('axe');
    expect(
      state.activities.find(
        (activity) => identityKey(activity.identity) === identityKey(manualIdentity('take')),
      )?.protection.completed,
    ).toBe(false);
  });

  it('撤销已完成交付会取消升级事实', () => {
    let state = createPlannerState(day, 'single');
    state = reducePlanner(state, { kind: 'setToolLevel', tool: 'axe', level: 'copper' });
    state = give(state, 'give', 'axe');
    state = toggle(state, 'give', true);
    state = toggle(state, 'give', false);
    expect(state.toolUpgrade).toBeNull();
    expect(state.activities[0]?.protection.completed).toBe(false);
  });
});
