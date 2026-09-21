import { deserializeState, serializeState } from '../core';
import type { PlannerState } from '../core';
import type { StorageAdapter } from './adapters';

export const STORAGE_KEY = 'stardew-planner:v1';

export type LoadOutcome =
  | { status: 'empty' }
  | { status: 'ok'; state: PlannerState }
  | { status: 'rejected'; reason: 'corrupt' | 'future-version' | 'unreadable' };

export type SaveOutcome = { ok: true } | { ok: false; error: string };

export interface StoragePort {
  load(): LoadOutcome;
  save(state: PlannerState): SaveOutcome;
  clear(): void;
}

/**
 * 把纯核心的序列化/校验与具体适配器隔开。
 * 核心不感知 localStorage；换适配器只需换一个 StorageAdapter。
 */
export function createStoragePort(adapter: StorageAdapter, key: string = STORAGE_KEY): StoragePort {
  return {
    load() {
      let raw: string | null;
      try {
        raw = adapter.read(key);
      } catch {
        return { status: 'rejected', reason: 'unreadable' };
      }
      if (raw === null) return { status: 'empty' };
      const result = deserializeState(raw);
      if (!result.ok) return { status: 'rejected', reason: result.reason };
      return { status: 'ok', state: result.state };
    },
    save(state) {
      try {
        adapter.write(key, serializeState(state));
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    clear() {
      try {
        adapter.remove(key);
      } catch {
        // 清空失败不改变内存中的状态；由后续写入或用户重试处理。
      }
    },
  };
}
