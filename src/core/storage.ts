import { migrateState } from './migrate';
import type { PlannerState } from './planner';
import { isPlannerState } from './validate';

/** 当前存档格式版本。未来格式版本一律拒绝，已知旧格式在此迁移。 */
export const STORAGE_VERSION = 4;

export type StoredDocument = {
  version: number;
  state: PlannerState;
};

export type DeserializeResult =
  | { ok: true; state: PlannerState }
  | { ok: false; reason: 'corrupt' | 'future-version' };

export function serializeState(state: PlannerState): string {
  const payload: StoredDocument = { version: STORAGE_VERSION, state };
  return JSON.stringify(payload);
}

/**
 * 解析存档：损坏 JSON、字段非法或未来版本一律拒绝，不返回半成品状态。
 * 已知旧格式先迁移，再按当前版本校验。
 */
export function deserializeState(raw: string): DeserializeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'corrupt' };
  }
  const payload = parsed as Record<string, unknown>;
  const version = payload.version;
  if (!Number.isInteger(version) || (version as number) < 1) {
    return { ok: false, reason: 'corrupt' };
  }
  if ((version as number) > STORAGE_VERSION) {
    return { ok: false, reason: 'future-version' };
  }
  if ((version as number) < STORAGE_VERSION) {
    const migrated = migrateState(version as number, payload.state);
    if (!migrated) return { ok: false, reason: 'corrupt' };
    return { ok: true, state: migrated };
  }
  if (!isPlannerState(payload.state)) {
    return { ok: false, reason: 'corrupt' };
  }
  return { ok: true, state: payload.state };
}
