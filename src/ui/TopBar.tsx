import type { GameDate, GameMode } from '../core';
import { GAME_MODE_LABELS, formatDate } from '../core';

type Props = {
  currentDay: GameDate;
  mode: GameMode;
  onAdd: () => void;
  onOpenStorage: () => void;
};

export function TopBar({ currentDay, mode, onAdd, onOpenStorage }: Props) {
  return (
    <header className="topbar">
      <div className="brand">星露谷日程规划</div>
      <div className="topbar-meta">
        <span className="chip">{formatDate(currentDay)}</span>
        <span className="chip">{GAME_MODE_LABELS[mode]}模式</span>
      </div>
      <button type="button" className="ghost" data-action="open-storage" onClick={onOpenStorage}>
        存储
      </button>
      <button type="button" className="primary" onClick={onAdd}>
        ＋ 添加
      </button>
    </header>
  );
}
