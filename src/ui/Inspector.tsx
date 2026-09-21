import { useEffect, useState } from 'react';
import type { Activity, ActivityDetails, ActivityPatch, ActivityType, ReservePreferences } from '../core';
import {
  ACTIVITY_TYPE_LABELS,
  DAY_START,
  LAST_START,
  MINUTE_STEP,
  formatDuration,
  formatTime,
  parseChecklist,
  systemReserve,
} from '../core';

type Props = {
  activity: Activity | null;
  preferences: ReservePreferences;
  onPatch: (patch: ActivityPatch) => void;
  onSaveDefault: (activityType: ActivityType, minutes: number) => void;
  onDelete: () => void;
  onToggleCompleted?: (completed: boolean) => void;
};

function startOptions(): number[] {
  const options: number[] = [];
  for (let value = DAY_START; value <= LAST_START; value += MINUTE_STEP) options.push(value);
  return options;
}

const START_OPTIONS = startOptions();

export function Inspector({ activity, preferences, onPatch, onSaveDefault, onDelete, onToggleCompleted = () => {} }: Props) {
  if (!activity) {
    return (
      <aside className="inspector">
        <div className="empty">点任意卡片编辑；在顶栏添加新活动。</div>
      </aside>
    );
  }

  const personal = preferences.personal[activity.activityType];
  const last = preferences.last[activity.activityType];
  const details = activity.details ?? {};
  const isTravel = activity.activityType === 'travel';
  const isSpot = activity.activityType === 'fishing' || activity.activityType === 'mining';

  function patchDetails(key: keyof ActivityDetails, value: string) {
    onPatch({ details: { ...details, [key]: value } });
  }

  return (
    <aside className="inspector">
      <h2>检查器</h2>
      <p className="hint">类型：{ACTIVITY_TYPE_LABELS[activity.activityType]}</p>
      <label>
        名称
        <input
          type="text"
          data-field="name"
          value={activity.name}
          onChange={(event) => onPatch({ name: event.target.value })}
        />
      </label>
      <label>
        开始时刻
        <select value={activity.start} onChange={(event) => onPatch({ start: Number(event.target.value) })}>
          {START_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {formatTime(value)}
            </option>
          ))}
        </select>
      </label>
      <DurationField value={activity.duration} onCommit={(duration) => onPatch({ duration })} />

      {isTravel ? (
        <>
          <label>
            起点（可选）
            <input
              type="text"
              data-field="from"
              value={details.from ?? ''}
              placeholder="例如：农场"
              onChange={(event) => patchDetails('from', event.target.value)}
            />
          </label>
          <label>
            终点（可选）
            <input
              type="text"
              data-field="to"
              value={details.to ?? ''}
              placeholder="例如：铁匠铺"
              onChange={(event) => patchDetails('to', event.target.value)}
            />
          </label>
          <p className="hint">工具不估算路线；时长由玩家填写。</p>
        </>
      ) : null}

      {isSpot ? (
        <>
          <label>
            地点（可选）
            <input
              type="text"
              data-field="place"
              value={details.place ?? ''}
              onChange={(event) => patchDetails('place', event.target.value)}
            />
          </label>
          <label>
            目标（自由文本）
            <input
              type="text"
              data-field="target"
              value={details.target ?? ''}
              onChange={(event) => patchDetails('target', event.target.value)}
            />
          </label>
          <p className="hint">V1 不估算产出或达成目标的时间。</p>
        </>
      ) : null}

      <label>
        备注
        <textarea
          data-field="note"
          rows={2}
          value={activity.note ?? ''}
          onChange={(event) => onPatch({ note: event.target.value })}
        />
      </label>
      <label>
        清单（每行一项）
        <textarea
          data-field="checklist"
          rows={3}
          value={(activity.checklist ?? []).join('\n')}
          onChange={(event) => onPatch({ checklist: parseChecklist(event.target.value) })}
        />
      </label>

      <label className="check-row">
        <input type="checkbox" checked={activity.protection.completed} onChange={(event) => onToggleCompleted(event.target.checked)} />
        已完成
      </label>
      <p className="hint">
        时长解析：当前手填值 ＞ 个人默认
        {personal === undefined ? '（未设置）' : ` ${formatDuration(personal)}`} ＞ 最近一次预留
        {last === undefined ? '（无）' : ` ${formatDuration(last)}`} ＞ 系统推荐预留{' '}
        {formatDuration(systemReserve(activity.activityType))}
      </p>
      <button
        type="button"
        className="ghost"
        onClick={() => onSaveDefault(activity.activityType, activity.duration)}
      >
        保存为个人默认
      </button>
      <p className="hint">单次手填不会改变个人默认；只有点击上方按钮才会。所有改动即时写入本地存储。</p>
      <button type="button" className="danger" onClick={onDelete}>
        删除活动
      </button>
    </aside>
  );
}

/**
 * 时长输入：编辑期间保留草稿，失焦或回车才提交。
 * 直接双向绑定会被 reducer 的粒度取整打断输入（例如输入 150 时被逐位夹成 10）。
 */
function DurationField({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed > 0) {
      onCommit(parsed);
    } else {
      setDraft(String(value));
    }
  }

  return (
    <label>
      预计时长
      <input
        type="number"
        data-field="duration"
        min={MINUTE_STEP}
        step={MINUTE_STEP}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
      />
    </label>
  );
}
