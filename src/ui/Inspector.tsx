import { useEffect, useState } from 'react';
import type { Activity, ActivityPatch } from '../core';
import { DAY_START, LAST_START, MINUTE_STEP, formatDuration, formatTime } from '../core';

type Props = {
  activity: Activity | null;
  onPatch: (patch: ActivityPatch) => void;
  onDelete: () => void;
};

function startOptions(): number[] {
  const options: number[] = [];
  for (let value = DAY_START; value <= LAST_START; value += MINUTE_STEP) options.push(value);
  return options;
}

const START_OPTIONS = startOptions();

export function Inspector({ activity, onPatch, onDelete }: Props) {
  if (!activity) {
    return (
      <aside className="inspector">
        <div className="empty">点任意卡片编辑；在顶栏添加新活动。</div>
      </aside>
    );
  }

  return (
    <aside className="inspector">
      <h2>检查器</h2>
      <label>
        名称
        <input
          type="text"
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
      <p className="hint">当前时长 {formatDuration(activity.duration)}；所有改动即时写入本地存储。</p>
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
