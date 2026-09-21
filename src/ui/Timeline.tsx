import { useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import type { Activity, DropTarget, SwapDirection } from '../core';
import {
  DAY_END,
  activityRange,
  formatDuration,
  formatTime,
  freeGaps,
  identityKey,
  resolveDropStart,
  sortedActivities,
} from '../core';

const PX_PER_MINUTE = 0.5;
const GAP_MIN_PX = 18;

type Props = {
  activities: Activity[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onMove: (key: string, start: number) => void;
  onSwap: (key: string, direction: SwapDirection) => void;
};

/**
 * 融合的单时间列：按开始时刻定位的活动卡片之间，用空白表达空闲并标注时长。
 * 拖动只在三个离散落点之间切换预览，落点时刻在放下时才提交，因此连续拖动不会产生中间时刻。
 */
export function Timeline({ activities, selectedKey, onSelect, onMove, onSwap }: Props) {
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const sorted = sortedActivities(activities);
  const gaps = freeGaps(activities);
  const dragging = draggingKey
    ? activities.find((activity) => identityKey(activity.identity) === draggingKey) ?? null
    : null;

  function commitDrop(target: DropTarget) {
    if (dragging) {
      const start = resolveDropStart(activities, dragging, target);
      if (start !== null) onMove(identityKey(dragging.identity), start);
    }
    cancelDrag();
  }

  function cancelDrag() {
    setDraggingKey(null);
    setDropTarget(null);
  }

  const rows: ReactNode[] = [];
  let gapIndex = 0;

  function pushGap(gap: { start: number; end: number; minutes: number }) {
    const highlighted = dropTarget?.kind === 'gap' && dropTarget.start === gap.start;
    rows.push(
      <GapRow
        key={`gap-${gap.start}`}
        minutes={gap.minutes}
        highlighted={highlighted}
        canDrop={draggingKey !== null}
        onDragOver={(event) => {
          if (draggingKey === null) return;
          event.preventDefault();
          setDropTarget({ kind: 'gap', start: gap.start });
        }}
        onDrop={(event) => {
          if (draggingKey === null) return;
          event.preventDefault();
          commitDrop({ kind: 'gap', start: gap.start });
        }}
      />,
    );
  }

  for (const activity of sorted) {
    while (gapIndex < gaps.length && (gaps[gapIndex]?.end ?? 0) <= activity.start) {
      pushGap(gaps[gapIndex]!);
      gapIndex += 1;
    }
    rows.push(
      <ActivityCard
        key={identityKey(activity.identity)}
        activity={activity}
        selected={identityKey(activity.identity) === selectedKey}
        isDragging={identityKey(activity.identity) === draggingKey}
        canDrop={draggingKey !== null && identityKey(activity.identity) !== draggingKey}
        dropSide={
          dropTarget && dropTarget.kind !== 'gap' && dropTarget.key === identityKey(activity.identity)
            ? dropTarget.kind
            : null
        }
        onSelect={onSelect}
        onSwap={onSwap}
        onDragStart={() => {
          setDraggingKey(identityKey(activity.identity));
          setDropTarget(null);
        }}
        onDragOver={(side) => setDropTarget({ kind: side, key: identityKey(activity.identity) })}
        onDrop={(side) => commitDrop({ kind: side, key: identityKey(activity.identity) })}
        onDragEnd={cancelDrag}
      />,
    );
  }
  while (gapIndex < gaps.length) {
    pushGap(gaps[gapIndex]!);
    gapIndex += 1;
  }

  return (
    <main className="timeline">
      <div className="panel-head">
        <h2>今日日程</h2>
        <span className="hint">纵向位置＝开始时刻 · 空白＝空闲 · 拖动落到三个离散位置 · ↑↓ 交换相邻开始时刻</span>
      </div>
      {rows.length ? rows : <div className="empty">这一天还没有活动。点「＋ 添加」开始。</div>}
    </main>
  );
}

function GapRow({
  minutes,
  highlighted,
  canDrop,
  onDragOver,
  onDrop,
}: {
  minutes: number;
  highlighted: boolean;
  canDrop: boolean;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const height = Math.max(GAP_MIN_PX, minutes * PX_PER_MINUTE);
  return (
    <div
      className={`gap${highlighted ? ' drop-target' : ''}`}
      style={{ height }}
      data-testid="gap"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span>{canDrop ? `放到空闲起点 · ${formatDuration(minutes)}` : `空闲 ${formatDuration(minutes)}`}</span>
    </div>
  );
}

function ActivityCard({
  activity,
  selected,
  isDragging,
  canDrop,
  dropSide,
  onSelect,
  onSwap,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  activity: Activity;
  selected: boolean;
  isDragging: boolean;
  canDrop: boolean;
  dropSide: 'before' | 'after' | null;
  onSelect: (key: string) => void;
  onSwap: (key: string, direction: SwapDirection) => void;
  onDragStart: () => void;
  onDragOver: (side: 'before' | 'after') => void;
  onDrop: (side: 'before' | 'after') => void;
  onDragEnd: () => void;
}) {
  const key = identityKey(activity.identity);
  const range = activityRange(activity);
  const over = range.end - DAY_END;

  /** 卡片上半＝紧贴其前，下半＝紧贴其后。 */
  function side(event: DragEvent<HTMLDivElement>): 'before' | 'after' {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  }

  const classes = [
    'card',
    selected ? 'selected' : '',
    isDragging ? 'dragging' : '',
    dropSide === 'before' ? 'drop-before' : '',
    dropSide === 'after' ? 'drop-after' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      draggable
      data-testid="activity-card"
      onDragStart={(event) => {
        event.dataTransfer?.setData('text/plain', key);
        onDragStart();
      }}
      onDragOver={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        onDragOver(side(event));
      }}
      onDrop={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        onDrop(side(event));
      }}
      onDragEnd={onDragEnd}
    >
      <button type="button" className="card-main" onClick={() => onSelect(key)}>
        <span className="card-time">{formatTime(activity.start)}</span>
        <span className="card-body">
          <span className="card-title">{activity.name}</span>
          <span className="card-meta">
            {formatTime(range.start)} – {formatTime(range.end)} · {formatDuration(activity.duration)}
          </span>
        </span>
        {over > 0 ? <span className="tag warn">超出游戏日 {formatDuration(over)}</span> : null}
      </button>
      <span className="card-move">
        <button
          type="button"
          title="与上一项交换开始时刻"
          aria-label="与上一项交换开始时刻"
          onClick={() => onSwap(key, 'up')}
        >
          ↑
        </button>
        <button
          type="button"
          title="与下一项交换开始时刻"
          aria-label="与下一项交换开始时刻"
          onClick={() => onSwap(key, 'down')}
        >
          ↓
        </button>
      </span>
    </div>
  );
}
