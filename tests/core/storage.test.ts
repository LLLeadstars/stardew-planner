import { describe, expect, it } from 'vitest';
import {
  STORAGE_VERSION,
  createPlannerState,
  deserializeState,
  inspectBackup,
  manualIdentity,
  reducePlanner,
  serializeState,
} from '../../src/core';
import type { PlannerState } from '../../src/core';

const day = { year: 1, season: 0, day: 3 } as const;

function sampleState(): PlannerState {
  const base = createPlannerState(day, 'multi');
  return reducePlanner(base, {
    kind: 'addActivity',
    identity: manualIdentity('a'),
    activityType: 'custom',
    name: '看电视',
    start: 370,
    duration: 10,
  });
}

describe('存档序列化与版本门禁', () => {
  it('往返后状态一致', () => {
    const state = sampleState();
    expect(serializeState(state)).toContain(`"version":${STORAGE_VERSION}`);
    const result = deserializeState(serializeState(state));
    expect(result).toEqual({ ok: true, state });
  });

  it('拒绝损坏的 JSON', () => {
    expect(deserializeState('{not json')).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('拒绝缺少版本或版本非法的文档', () => {
    expect(deserializeState(JSON.stringify({ state: sampleState() }))).toEqual({ ok: false, reason: 'corrupt' });
    expect(deserializeState(JSON.stringify({ version: 0, state: sampleState() }))).toEqual({
      ok: false,
      reason: 'corrupt',
    });
  });

  it('拒绝未来格式版本', () => {
    const future = JSON.stringify({ version: STORAGE_VERSION + 1, state: sampleState() });
    expect(deserializeState(future)).toEqual({ ok: false, reason: 'future-version' });
  });

  it('拒绝字段非法的状态', () => {
    const invalid = JSON.stringify({
      version: STORAGE_VERSION,
      state: { currentDay: day, mode: 'single', activities: [{ identity: { kind: 'manual', id: 'a' }, activityType: 'custom', name: 'x', start: 361, duration: 60, protection: { editedByPlayer: false, completed: false } }], reserves: { personal: {}, last: {} } },
    });
    expect(deserializeState(invalid)).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('拒绝缺少受保护标记的活动', () => {
    const invalid = JSON.stringify({
      version: STORAGE_VERSION,
      state: {
        currentDay: day,
        mode: 'single',
        activities: [{ identity: { kind: 'manual', id: 'a' }, activityType: 'custom', name: 'x', start: 360, duration: 60 }],
        reserves: { personal: {}, last: {} },
      },
    });
    expect(deserializeState(invalid)).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('拒绝缺少预留偏好的当前版本状态', () => {
    const invalid = JSON.stringify({
      version: STORAGE_VERSION,
      state: {
        currentDay: day,
        mode: 'single',
        activities: [],
      },
    });
    expect(deserializeState(invalid)).toEqual({ ok: false, reason: 'corrupt' });
  });
});

describe('当次信息（备注、清单、赶路/钓鱼/采矿字段）', () => {
  it('往返后保留内置活动类型与当次信息', () => {
    const state = reducePlanner(createPlannerState(day, 'single'), {
      kind: 'addActivity',
      identity: manualIdentity('t'),
      activityType: 'travel',
      name: '赶路',
      start: 360,
      note: '顺路买种子',
      checklist: ['买防风草种子', '取回锄头'],
      details: { from: '农场', to: '镇上' },
    });
    const result = deserializeState(serializeState(state));
    expect(result).toEqual({ ok: true, state });
  });

  it('拒绝非文本清单', () => {
    const base = serializeState(sampleState());
    const parsed = JSON.parse(base) as { state: { activities: Record<string, unknown>[] } };
    parsed.state.activities[0]!.checklist = [{ text: '不是字符串' }];
    expect(deserializeState(JSON.stringify({ version: STORAGE_VERSION, state: parsed.state }))).toEqual({
      ok: false,
      reason: 'corrupt',
    });
  });

  it('拒绝含有未知字段的当次信息', () => {
    const base = serializeState(sampleState());
    const parsed = JSON.parse(base) as { state: { activities: Record<string, unknown>[] } };
    parsed.state.activities[0]!.details = { route: '农场 → 镇上' };
    expect(deserializeState(JSON.stringify({ version: STORAGE_VERSION, state: parsed.state }))).toEqual({
      ok: false,
      reason: 'corrupt',
    });
  });
});

describe('玩家状态与今天前提的存档', () => {
  it('往返后保留玩家状态与天气/特殊日', () => {
    let state = createPlannerState(day, 'single');
    state = reducePlanner(state, { kind: 'setWeather', value: 'rain' });
    state = reducePlanner(state, { kind: 'setSpecialDay', value: 'festival' });
    state = reducePlanner(state, { kind: 'setCommunityCenter', value: 'restored' });
    state = reducePlanner(state, { kind: 'setToolLevel', tool: 'can', level: 'copper' });
    expect(deserializeState(serializeState(state))).toEqual({ ok: true, state });
  });

  it('拒绝未知的玩家状态取值', () => {
    const parsed = JSON.parse(serializeState(sampleState())) as {
      state: { playerStates: Record<string, unknown> };
    };
    parsed.state.playerStates = { weather: 'snow' };
    expect(deserializeState(JSON.stringify({ version: STORAGE_VERSION, state: parsed.state }))).toEqual({
      ok: false,
      reason: 'corrupt',
    });
  });
});

describe('导入预览与导出信封', () => {
  it('解析备份后给出领域数据摘要，并保留完整状态', () => {
    let state = createPlannerState(day, 'multi');
    state = reducePlanner(state, {
      kind: 'addActivity',
      identity: manualIdentity('a'),
      activityType: 'custom',
      name: '甲',
      start: 370,
      duration: 10,
    });
    state = reducePlanner(state, {
      kind: 'addActivity',
      identity: manualIdentity('b'),
      activityType: 'fishing',
      name: '乙',
      start: 400,
    });
    state = reducePlanner(state, { kind: 'toggleActivityCompleted', key: 'manual:a' });
    state = reducePlanner(state, { kind: 'savePersonalReserve', activityType: 'custom', minutes: 40 });
    state = reducePlanner(state, { kind: 'setWeather', value: 'rain' });

    const result = inspectBackup(serializeState(state));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.version).toBe(STORAGE_VERSION);
    expect(result.state).toEqual(state);
    expect(result.preview).toEqual({
      currentDay: day,
      mode: 'multi',
      activityCount: 2,
      completedCount: 1,
      playerStateCount: 1,
      personalReserveCount: 1,
      lastReserveCount: 1,
    });
  });

  it('导出信封整体序列化状态，后续切片新增领域数据自动纳入', () => {
    const original = sampleState();
    const withFutureData = {
      ...original,
      cropBatches: [{ id: 'batch-1', crop: '防风草' }],
    } as unknown as PlannerState;
    const result = inspectBackup(serializeState(withFutureData));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.state as unknown as { cropBatches: unknown }).cropBatches).toEqual([
      { id: 'batch-1', crop: '防风草' },
    ]);
  });

  it('损坏、非对象或未来版本的文件在预览阶段就被拒绝', () => {
    expect(inspectBackup('{不是 JSON')).toEqual({ ok: false, reason: 'corrupt' });
    expect(inspectBackup('[]')).toEqual({ ok: false, reason: 'corrupt' });
    expect(inspectBackup(JSON.stringify({ version: STORAGE_VERSION + 1, state: sampleState() }))).toEqual({
      ok: false,
      reason: 'future-version',
    });
  });

  it('旧格式先迁移再预览，并报告来源版本', () => {
    const legacy = JSON.stringify({
      version: 1,
      state: { currentDay: day, mode: 'single', activities: [LEGACY_ACTIVITY] },
    });
    const result = inspectBackup(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.version).toBe(1);
    expect(result.state.activities[0]?.activityType).toBe('custom');
    expect(result.preview.activityCount).toBe(1);
    expect(result.preview.personalReserveCount).toBe(0);
  });
});

const LEGACY_ACTIVITY = {
  identity: { kind: 'manual', id: 'a' },
  name: '看电视',
  start: 370,
  duration: 10,
  protection: { editedByPlayer: false, completed: false },
};

describe('旧格式（v3）迁移', () => {
  it('v3 存档补上空的玩家状态', () => {
    const legacy = JSON.stringify({
      version: 3,
      state: {
        currentDay: day,
        mode: 'single',
        activities: [{ ...LEGACY_ACTIVITY, activityType: 'custom' }],
        reserves: { personal: {}, last: {} },
      },
    });
    const result = deserializeState(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.playerStates).toEqual({});
    expect(result.state.activities[0]?.activityType).toBe('custom');
  });
});

describe('旧格式（v1）迁移', () => {
  it('v1 存档补上活动类型与空的预留偏好', () => {
    const legacy = JSON.stringify({
      version: 1,
      state: { currentDay: day, mode: 'single', activities: [LEGACY_ACTIVITY] },
    });
    const result = deserializeState(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.reserves).toEqual({ personal: {}, last: {} });
    expect(result.state.activities[0]?.activityType).toBe('custom');
    expect(result.state.activities[0]?.name).toBe('看电视');
    expect(result.state.activities[0]?.start).toBe(370);
  });

  it('v1 里字段非法的活动会被拒绝', () => {
    const legacy = JSON.stringify({
      version: 1,
      state: { currentDay: day, mode: 'single', activities: [{ ...LEGACY_ACTIVITY, start: 361 }] },
    });
    expect(deserializeState(legacy)).toEqual({ ok: false, reason: 'corrupt' });
  });
});

describe('旧格式（v2）迁移', () => {
  it('v2 存档没有当次信息也照常读入', () => {
    const legacy = JSON.stringify({
      version: 2,
      state: {
        currentDay: day,
        mode: 'single',
        activities: [{ ...LEGACY_ACTIVITY, activityType: 'custom' }],
        reserves: { personal: {}, last: {} },
      },
    });
    const result = deserializeState(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activities[0]?.activityType).toBe('custom');
    expect(result.state.activities[0]?.note).toBeUndefined();
    expect(result.state.activities[0]?.checklist).toBeUndefined();
    expect(result.state.activities[0]?.details).toBeUndefined();
  });

  it('v2 里字段非法的状态会被拒绝', () => {
    const legacy = JSON.stringify({
      version: 2,
      state: {
        currentDay: day,
        mode: 'single',
        activities: [{ ...LEGACY_ACTIVITY, activityType: 'not-a-type' }],
        reserves: { personal: {}, last: {} },
      },
    });
    expect(deserializeState(legacy)).toEqual({ ok: false, reason: 'corrupt' });
  });
});
