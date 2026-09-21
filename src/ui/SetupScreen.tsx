import { useState } from 'react';
import type { FormEvent } from 'react';
import type { GameDate, GameMode, Season } from '../core';
import { GAME_MODE_LABELS, SEASON_NAMES, SEASONS } from '../core';

type Props = {
  notice?: string;
  onStart: (day: GameDate, mode: GameMode) => void;
  onOpenStorage: () => void;
};

export function SetupScreen({ notice, onStart, onOpenStorage }: Props) {
  const [year, setYear] = useState(1);
  const [season, setSeason] = useState<Season>(0);
  const [day, setDay] = useState(1);
  const [mode, setMode] = useState<GameMode>('single');

  function submit(event: FormEvent) {
    event.preventDefault();
    const safeDay = Math.min(28, Math.max(1, Math.round(day) || 1));
    const safeYear = Math.max(1, Math.round(year) || 1);
    onStart({ year: safeYear, season, day: safeDay }, mode);
  }

  return (
    <div className="setup">
      <form className="setup-card" onSubmit={submit}>
        <h1>星露谷日程规划</h1>
        <p className="hint">首次使用只问当前游戏日与游戏模式，其余信息在相关活动首次需要时再收集。</p>
        {notice ? <p className="notice">{notice}</p> : null}

        <fieldset>
          <legend>当前游戏日</legend>
          <div className="setup-row">
            <label>
              第几年
              <input
                type="number"
                min={1}
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              />
            </label>
            <label>
              季节
              <select value={season} onChange={(event) => setSeason(Number(event.target.value) as Season)}>
                {SEASONS.map((value) => (
                  <option key={value} value={value}>
                    {SEASON_NAMES[value]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              第几日
              <input
                type="number"
                min={1}
                max={28}
                value={day}
                onChange={(event) => setDay(Number(event.target.value))}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>游戏模式</legend>
          <div className="setup-row">
            {(['single', 'multi'] as const).map((value) => (
              <label key={value} className="choice">
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                {GAME_MODE_LABELS[value]}
              </label>
            ))}
          </div>
          <p className="hint">V1 只提供手动预留时长；模式影响后续切片的规则判断。</p>
        </fieldset>

        <button type="submit" className="primary">
          开始规划
        </button>
        <button type="button" className="ghost" data-action="open-storage" onClick={onOpenStorage}>
          从备份导入
        </button>
      </form>
    </div>
  );
}
