import type { GameDate, GameMode } from '../core';
import { DAY_END, DAY_START, GAME_MODE_LABELS, formatDate, formatTime } from '../core';

type Props = {
  currentDay: GameDate;
  mode: GameMode;
  activityCount: number;
  gapCount: number;
  overrunCount: number;
  collapsed: boolean;
  onToggle: () => void;
};

export function LeftPanel({ currentDay, mode, activityCount, gapCount, overrunCount, collapsed, onToggle }: Props) {
  if (collapsed) {
    return (
      <aside className="left collapsed">
        <button type="button" className="ghost" title="展开信息栏" onClick={onToggle}>
          ›
        </button>
      </aside>
    );
  }

  return (
    <aside className="left">
      <div className="left-head">
        <h2>今天的前提</h2>
        <button type="button" className="ghost" title="收起信息栏" onClick={onToggle}>
          ‹
        </button>
      </div>
      <dl className="kv">
        <dt>游戏日</dt>
        <dd>{formatDate(currentDay)}</dd>
        <dt>模式</dt>
        <dd>{GAME_MODE_LABELS[mode]}</dd>
        <dt>区间</dt>
        <dd>
          {formatTime(DAY_START)} – {formatTime(DAY_END)}
        </dd>
      </dl>

      <h2>今日检查</h2>
      <ul className="checklist">
        <li>{activityCount} 项活动</li>
        <li>{gapCount} 段空闲</li>
        <li className={overrunCount ? 'warn' : ''}>
          {overrunCount ? `${overrunCount} 项超出游戏日` : '没有超出游戏日'}
        </li>
      </ul>
    </aside>
  );
}
