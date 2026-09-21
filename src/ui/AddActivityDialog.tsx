import { useState } from 'react';
import type { FormEvent } from 'react';
import { DEFAULT_CUSTOM_DURATION, MINUTE_STEP, formatDuration } from '../core';

type Props = {
  onCancel: () => void;
  onSubmit: (name: string, duration: number) => void;
};

export function AddActivityDialog({ onCancel, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(DEFAULT_CUSTOM_DURATION);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(name.trim() || '自定义活动', duration);
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
              if (!Number.isNaN(value)) setDuration(value);
            }}
          />
        </label>
        <p className="hint">将占用 {formatDuration(duration)}，开始时刻默认落在第一个空闲时段。</p>
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
