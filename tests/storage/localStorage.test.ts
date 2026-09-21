// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createPlannerState, manualIdentity, reducePlanner } from '../../src/core';
import { createLocalStorageAdapter } from '../../src/storage/localStorage';
import { STORAGE_KEY, createStoragePort } from '../../src/storage/port';
import { describeStoragePortContract } from './contract';

describeStoragePortContract('localStorage 适配器', {
  createAdapter: () => createLocalStorageAdapter(window.localStorage),
  reset: () => window.localStorage.clear(),
});

describe('localStorage 真实往返', () => {
  it('数据确实写入 window.localStorage，并能原样读回', () => {
    window.localStorage.clear();
    const port = createStoragePort(createLocalStorageAdapter(window.localStorage));
    const state = reducePlanner(createPlannerState({ year: 2, season: 3, day: 28 }, 'multi'), {
      kind: 'addActivity',
      identity: manualIdentity('a'),
      activityType: 'custom',
      name: '看电视',
      start: 370,
      duration: 10,
    });
    expect(port.save(state)).toEqual({ ok: true });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy();
    expect(port.load()).toEqual({ status: 'ok', state });
  });

  it('损坏的已有数据被拒绝', () => {
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEY, '完全不是 JSON');
    const port = createStoragePort(createLocalStorageAdapter(window.localStorage));
    expect(port.load()).toEqual({ status: 'rejected', reason: 'corrupt' });
  });
});
