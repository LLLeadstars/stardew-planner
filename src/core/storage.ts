import type { GameDate } from './date';
import { migrateState } from './migrate';
import type { GameMode, PlannerState } from './planner';
import { isPlannerState } from './validate';

/** 当前存档格式版本。未来格式版本一律拒绝，已知旧格式在此迁移。 */
export const STORAGE_VERSION = 7;

export type StoredDocument = {
  version: number;
  state: PlannerState;
};

export type DeserializeResult =
  | { ok: true; state: PlannerState }
  | { ok: false; reason: 'corrupt' | 'future-version' };

/**
 * 导入前给玩家看的领域数据摘要。
 * 它只是既有状态的投影；后续切片新增领域数据时在此追加一行计数即可，
 * 备份信封本身无需改动。
 */
export type BackupPreview = {
  currentDay: GameDate;
  mode: GameMode;
  activityCount: number;
  completedCount: number;
  cropBatchCount: number;
  playerStateCount: number;
  personalReserveCount: number;
  lastReserveCount: number;
};

export type BackupRejection = { ok: false; reason: 'corrupt' | 'future-version' };

/**
 * 导入检查结果：要么给出拒绝原因，要么给出可预览、可替换的状态。
 * `version` 是文件里的来源格式版本（可能小于当前版本，表示将自动迁移）。
 */
export type BackupInspection =
  | BackupRejection
  | { ok: true; version: number; state: PlannerState; preview: BackupPreview };

export function serializeState(state: PlannerState): string {
  const payload: StoredDocument = { version: STORAGE_VERSION, state };
  return JSON.stringify(payload);
}

/**
 * 解析存档：损坏 JSON、字段非法或未来版本一律拒绝，不返回半成品状态。
 * 已知旧格式先迁移，再按当前版本校验。
 */
export function deserializeState(raw: string): DeserializeResult {
  const parsed = parseBackup(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, state: parsed.state };
}

/** 解析并摘要一份备份，供导入预览与二次确认使用；不产生任何副作用。 */
export function inspectBackup(raw: string): BackupInspection {
  const parsed = parseBackup(raw);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    version: parsed.version,
    state: parsed.state,
    preview: previewState(parsed.state),
  };
}

type ParsedBackup = BackupRejection | { ok: true; version: number; state: PlannerState };

function parseBackup(raw: string): ParsedBackup {
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
    return { ok: true, version: version as number, state: migrated };
  }
  if (!isPlannerState(payload.state)) {
    return { ok: false, reason: 'corrupt' };
  }
  return { ok: true, version: version as number, state: payload.state };
}

function previewState(state: PlannerState): BackupPreview {
  const { weather, specialDay, communityCenter, townKey, robinWorking, toolLevels } =
    state.playerStates;
  const singleValues = [weather, specialDay, communityCenter, townKey, robinWorking].filter(
    (value) => value !== undefined,
  ).length;
  return {
    currentDay: state.currentDay,
    mode: state.mode,
    activityCount: state.activities.length,
    completedCount: state.activities.filter((activity) => activity.protection.completed).length,
    cropBatchCount: state.cropBatches.length,
    playerStateCount: singleValues + (toolLevels ? Object.keys(toolLevels).length : 0),
    personalReserveCount: Object.keys(state.reserves.personal).length,
    lastReserveCount: Object.keys(state.reserves.last).length,
  };
}
