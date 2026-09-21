import { describe, expect, it } from 'vitest';
import { createPlannerState, manualIdentity, reducePlanner } from '../../src/core';
import type { PlannerState } from '../../src/core';
import type { StorageAdapter } from '../../src/storage/adapters';
import { STORAGE_KEY, createStoragePort } from '../../src/storage/port';

export type StorageContractHarness = {
  /** 每次返回一个干净的适配器。 */
  createAdapter: () => StorageAdapter;
  /** 清空底层持久化（localStorage 需要；内存适配器可空实现）。 */
  reset: () => void;
};

const day = { year: 1, season: 0, day: 3 } as const;

function sampleState(): PlannerState {
  return reducePlanner(createPlannerState(day, 'single'), {
    kind: 'addActivity',
    identity: manualIdentity('a'),
    activityType: 'custom',
    name: '看电视',
    start: 370,
    duration: 10,
  });
}

function throwingAdapter(error: string): StorageAdapter {
  return {
    read: () => {
      throw new Error(error);
    },
    write: () => {
      throw new Error(error);
    },
    remove: () => {
      throw new Error(error);
    },
  };
}

/**
 * 存储端口的契约：内存适配器与 localStorage 适配器共用。
 * 断言只看外部可观察行为（load/save/clear 的结果），不碰适配器内部。
 */
export function describeStoragePortContract(name: string, harness: StorageContractHarness): void {
  describe(`存储端口契约：${name}`, () => {
    it('没有数据时返回 empty', () => {
      harness.reset();
      expect(createStoragePort(harness.createAdapter()).load()).toEqual({ status: 'empty' });
    });

    it('写入后往返一致', () => {
      harness.reset();
      const port = createStoragePort(harness.createAdapter());
      const state = sampleState();
      expect(port.save(state)).toEqual({ ok: true });
      expect(port.load()).toEqual({ status: 'ok', state });
    });

    it('重复写入以最后一次为准', () => {
      harness.reset();
      const port = createStoragePort(harness.createAdapter());
      const first = sampleState();
      const second = { ...first, mode: 'multi' as const };
      port.save(first);
      port.save(second);
      expect(port.load()).toEqual({ status: 'ok', state: second });
    });

    it('写入失败时返回错误', () => {
      const failing = createStoragePort(throwingAdapter('磁盘已满'));
      expect(failing.save(sampleState())).toEqual({ ok: false, error: '磁盘已满' });
    });

    it('拒绝损坏的已有数据', () => {
      harness.reset();
      const adapter = harness.createAdapter();
      adapter.write(STORAGE_KEY, '{不是 JSON');
      expect(createStoragePort(adapter).load()).toEqual({ status: 'rejected', reason: 'corrupt' });
    });

    it('拒绝未来格式版本', () => {
      harness.reset();
      const adapter = harness.createAdapter();
      adapter.write(STORAGE_KEY, JSON.stringify({ version: 999, state: sampleState() }));
      expect(createStoragePort(adapter).load()).toEqual({ status: 'rejected', reason: 'future-version' });
    });

    it('读取失败时返回 unreadable', () => {
      harness.reset();
      expect(createStoragePort(throwingAdapter('不可访问')).load()).toEqual({
        status: 'rejected',
        reason: 'unreadable',
      });
    });

    it('清空后回到 empty', () => {
      harness.reset();
      const port = createStoragePort(harness.createAdapter());
      port.save(sampleState());
      port.clear();
      expect(port.load()).toEqual({ status: 'empty' });
    });
  });
}
