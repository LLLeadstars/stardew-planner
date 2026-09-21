import { useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  GAME_MODE_LABELS,
  STORAGE_VERSION,
  dateKey,
  formatDate,
  inspectBackup,
  serializeState,
} from '../core';
import type { BackupInspection, BackupRejection, PlannerState } from '../core';
import { readFileText, saveTextFile } from '../storage/download';

type Props = {
  state: PlannerState | null;
  onImport: (state: PlannerState) => void;
  onClear: () => void;
  onClose: () => void;
  /** 文件下载与读取是外部 I/O；默认走浏览器，测试可注入替身。 */
  saveFile?: (filename: string, text: string) => void;
  readFile?: (file: File) => Promise<string>;
};

/**
 * 「存储」面板：导出全量备份、导入替换、清空重来。
 * 导入永远先预览再确认；被拒绝的文件不触碰当前状态。
 */
export function StoragePanel({
  state,
  onImport,
  onClear,
  onClose,
  saveFile = saveTextFile,
  readFile = readFileText,
}: Props) {
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await readFile(file);
      setInspection(inspectBackup(text));
    } catch {
      setInspection({ ok: false, reason: 'corrupt' });
    }
    setFileName(file.name);
    input.value = '';
  }

  function exportBackup() {
    if (!state) return;
    saveFile(`stardew-planner-${dateKey(state.currentDay)}.json`, serializeState(state));
  }

  function confirmImport(next: PlannerState) {
    onImport(next);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal storage-panel"
        role="dialog"
        aria-label="存储"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-head">
          <h2>存储</h2>
          <button type="button" className="ghost" onClick={onClose}>
            关闭
          </button>
        </div>
        <p className="hint">
          数据保存在当前浏览器。备份是带格式版本号的 JSON，只含日程领域数据，不含选中项、展开面板或筛选等临时界面状态。
        </p>

        {state ? (
          <section className="storage-section">
            <h3>导出</h3>
            <button type="button" className="ghost" data-action="export" onClick={exportBackup}>
              导出 JSON 备份
            </button>
          </section>
        ) : null}

        <section className="storage-section">
          <h3>导入</h3>
          <p className="hint">导入默认替换当前全部数据：先看预览，再确认替换。</p>
          <input
            type="file"
            accept="application/json,.json"
            data-field="import-file"
            onChange={handleFile}
          />
          {inspection ? (
            inspection.ok ? (
              <BackupPreviewCard
                inspection={inspection}
                fileName={fileName}
                onDismiss={() => setInspection(null)}
                onConfirm={() => confirmImport(inspection.state)}
              />
            ) : (
              <RejectionNotice
                rejection={inspection}
                fileName={fileName}
                onDismiss={() => setInspection(null)}
              />
            )
          ) : null}
        </section>

        {state ? (
          <section className="storage-section">
            <h3>清空</h3>
            {confirmingClear ? (
              <>
                <p className="notice">清空会移除本浏览器中的全部日程数据，且无法撤销。</p>
                <div className="modal-actions">
                  <button type="button" className="ghost" onClick={() => setConfirmingClear(false)}>
                    取消
                  </button>
                  <button
                    type="button"
                    className="danger"
                    data-action="confirm-clear"
                    onClick={() => {
                      onClear();
                      onClose();
                    }}
                  >
                    确认清空并重新开始
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="danger"
                data-action="clear"
                onClick={() => setConfirmingClear(true)}
              >
                清空数据并重新开始
              </button>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function BackupPreviewCard({
  inspection,
  fileName,
  onDismiss,
  onConfirm,
}: {
  inspection: Extract<BackupInspection, { ok: true }>;
  fileName: string | null;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const { preview, version } = inspection;
  return (
    <div className="backup-preview" data-status="ok">
      <p className="hint">
        来自 {fileName ?? '所选文件'}（格式版本 v{version}
        {version < STORAGE_VERSION ? `，将自动迁移到 v${STORAGE_VERSION}` : ''}）
      </p>
      <dl className="kv">
        <dt>游戏日</dt>
        <dd>{formatDate(preview.currentDay)}</dd>
        <dt>模式</dt>
        <dd>{GAME_MODE_LABELS[preview.mode]}</dd>
        <dt>活动</dt>
        <dd>
          {preview.activityCount} 项（已完成 {preview.completedCount}）
        </dd>
        <dt>玩家状态</dt>
        <dd>{preview.playerStateCount} 项</dd>
        <dt>个人默认预留</dt>
        <dd>{preview.personalReserveCount} 类</dd>
        <dt>最近一次预留</dt>
        <dd>{preview.lastReserveCount} 类</dd>
      </dl>
      <div className="modal-actions">
        <button type="button" className="ghost" onClick={onDismiss}>
          取消
        </button>
        <button type="button" className="primary" data-action="confirm-import" onClick={onConfirm}>
          确认替换当前数据
        </button>
      </div>
    </div>
  );
}

function RejectionNotice({
  rejection,
  fileName,
  onDismiss,
}: {
  rejection: BackupRejection;
  fileName: string | null;
  onDismiss: () => void;
}) {
  return (
    <div className="notice" data-status="rejected">
      <p>{rejectionMessage(rejection)}</p>
      <p className="hint">{fileName ?? '所选文件'}未被导入，现有数据保持不变。</p>
      <div className="modal-actions">
        <button type="button" className="ghost" onClick={onDismiss}>
          知道了
        </button>
      </div>
    </div>
  );
}

function rejectionMessage(rejection: BackupRejection): string {
  return rejection.reason === 'future-version'
    ? '文件来自更新的格式版本，当前工具无法导入。'
    : '文件已损坏或字段非法，无法导入。';
}
