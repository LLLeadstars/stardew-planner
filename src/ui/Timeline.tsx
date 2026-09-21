import { useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import type {
  Activity,
  DropTarget,
  GameDate,
  PlayerStates,
  ShopJudgement,
  SwapDirection,
} from '../core';
import {
  DAY_END,
  activityRange,
  activityStateSummary,
  formatDuration,
  formatTime,
  freeGaps,
  judgeShop,
  overlapsOf,
  conflictGroupKeys,
  identityKey,
  resolveDropStart,
  sortedActivities,
} from '../core';
import { ShopAvailabilityList } from './ShopAvailability';

const PX_PER_MINUTE = 0.5;
const GAP_MIN_PX = 18;

type Props = {
  activities: Activity[];
  currentDay: GameDate;
  playerStates: PlayerStates;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onMove: (key: string, start: number) => void;
  onSwap: (key: string, direction: SwapDirection) => void;
};

/**
 * 融合的单时间列：按开始时刻定位的活动卡片之间，用空白表达空闲并标注时长。
 * 拖动只在三个离散落点之间切换预览，落点时刻在放下时才提交，因此连续拖动不会产生中间时刻。
 */
export function Timeline({ activities, currentDay, playerStates, selectedKey, onSelect, onMove, onSwap }: Props) {
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [compactGaps, setCompactGaps] = useState(false);

  const sorted = sortedActivities(activities);
  const gaps = freeGaps(activities);
  const groups = conflictGroupKeys(activities);
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
        compact={compactGaps}
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
        overlaps={overlapsOf(activity, activities)}
        group={groups.get(identityKey(activity.identity))}
        stateSummary={activityStateSummary(activity, playerStates)}
        shopJudgement={
          activity.activityType === 'shop' && activity.details?.shop
            ? judgeShop(activity.details.shop, currentDay, playerStates)
            : null
        }
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
        <button type="button" className="ghost" onClick={() => setCompactGaps((value) => !value)}>{compactGaps ? '真实比例留白' : '紧凑留白'}</button>
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
  compact,
}: {
  minutes: number;
  highlighted: boolean;
  canDrop: boolean;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  compact: boolean;
}) {
  const height = compact ? 30 : Math.max(GAP_MIN_PX, minutes * PX_PER_MINUTE);
  return (
    <div
      className={`gap${highlighted ? ' drop-target' : ''}`}
      style={{ height }}
      data-testid="gap"
      title={compact ? `实际空闲 ${formatDuration(minutes)}` : undefined}
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
  overlaps,
  group,
  stateSummary,
  shopJudgement,
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
  overlaps: ReturnType<typeof overlapsOf>;
  group?: number;
  stateSummary: string | null;
  shopJudgement: ShopJudgement | null;
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
          {group !== undefined && overlaps.length > 0 ? <span className="tag warn">冲突组 {group}</span> : null}
          {overlaps.map((overlap) => <span className="overlap" key={identityKey(overlap.activity.identity)}>{overlap.relation === 'contains' ? `包含：${overlap.activity.name}` : overlap.relation === 'contained-by' ? `被包含：${overlap.activity.name}` : `同时进行 · 重叠 ${formatDuration(overlap.minutes)}：${overlap.activity.name}`}</span>)}
          {detailSummary(activity) ? (
            <span className="card-detail">{detailSummary(activity)}</span>
          ) : null}
          {shopJudgement ? (
            <ShopAvailabilityList judgement={shopJudgement} />
          ) : stateSummary ? (
            <span className="card-state" data-testid="activity-state-summary">
              {stateSummary}
            </span>
          ) : null}
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

/** 卡片上只展示玩家自己填的当次信息，不做任何路线或产出推算。 */
function detailSummary(activity: Activity): string | null {
  const details = activity.details;
  if (!details) return null;
  if (activity.activityType === 'travel') {
    if (details.from && details.to) return `${details.from} → ${details.to}`;
    if (details.from) return `起点 ${details.from}`;
    if (details.to) return `终点 ${details.to}`;
    return null;
  }
  const parts: string[] = [];
  if (details.place) parts.push(details.place);
  if (details.target) parts.push(`目标：${details.target}`);
  return parts.length ? parts.join(' · ') : null;
}
