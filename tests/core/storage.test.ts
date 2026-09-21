import { describe, expect, it } from 'vitest';
import {
  STORAGE_VERSION,
  createPlannerState,
  deserializeState,
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

const LEGACY_ACTIVITY = {
  identity: { kind: 'manual', id: 'a' },
  name: '看电视',
  start: 370,
  duration: 10,
  protection: { editedByPlayer: false, completed: false },
};

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
