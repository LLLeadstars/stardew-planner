import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { MINUTE_STEP, formatDuration, resolveReserve } from '../core';
import type { ActivityType, DurationSource, ReservePreferences } from '../core';

type Props = {
  activityType: ActivityType;
  preferences: ReservePreferences;
  onCancel: () => void;
  onSubmit: (name: string, duration?: number) => void;
};

const SOURCE_LABELS: Record<DurationSource, string> = {
  manual: '当前手填值',
  personal: '个人默认',
  last: '最近一次预留',
  system: '系统推荐预留',
};

export function AddActivityDialog({ activityType, preferences, onCancel, onSubmit }: Props) {
  const prefill = useMemo(
    () => resolveReserve({ activityType, preferences }),
    [activityType, preferences],
  );
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(prefill.minutes);
  const [touched, setTouched] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    // 未改动时长时让 reducer 走解析链；改动过才作为「当前活动手填值」提交。
    onSubmit(name.trim() || '自定义活动', touched ? duration : undefined);
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>添加自定义活动</h2>
        <label>
          名称
          <input
            type="text"
            autoFocus
            value={name}
            placeholder="自定义活动"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          预计时长
          <input
            type="number"
            min={MINUTE_STEP}
            step={MINUTE_STEP}
            value={duration}
            onChange={(event) => {
              const value = event.target.valueAsNumber;
              if (!Number.isNaN(value)) {
                setDuration(value);
                setTouched(true);
              }
            }}
          />
        </label>
        <p className="hint">
          将占用 {formatDuration(duration)}，来自{touched ? SOURCE_LABELS.manual : SOURCE_LABELS[prefill.source]}
          （可编辑的规划起点，不是对活动成果的预测）。
        </p>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="primary">
            添加
          </button>
        </div>
      </form>
    </div>
  );
}
