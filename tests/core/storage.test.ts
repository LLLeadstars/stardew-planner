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
      state: { currentDay: day, mode: 'single', activities: [{ identity: { kind: 'manual', id: 'a' }, name: 'x', start: 361, duration: 60, protection: { editedByPlayer: false, completed: false } }] },
    });
    expect(deserializeState(invalid)).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('拒绝缺少受保护标记的活动', () => {
    const invalid = JSON.stringify({
      version: STORAGE_VERSION,
      state: {
        currentDay: day,
        mode: 'single',
        activities: [{ identity: { kind: 'manual', id: 'a' }, name: 'x', start: 360, duration: 60 }],
      },
    });
    expect(deserializeState(invalid)).toEqual({ ok: false, reason: 'corrupt' });
  });
});
