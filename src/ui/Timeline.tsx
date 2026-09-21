import type { ReactNode } from 'react';
import type { Activity } from '../core';
import {
  DAY_END,
  activityRange,
  formatDuration,
  formatTime,
  freeGaps,
  identityKey,
  sortedActivities,
} from '../core';

const PX_PER_MINUTE = 0.5;
const GAP_MIN_PX = 18;

type Props = {
  activities: Activity[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

/** 融合的单时间列：按开始时刻定位的活动卡片之间，用空白表达空闲并标注时长。 */
export function Timeline({ activities, selectedKey, onSelect }: Props) {
  const sorted = sortedActivities(activities);
  const gaps = freeGaps(activities);
  const rows: ReactNode[] = [];
  let gapIndex = 0;

  for (const activity of sorted) {
    while (gapIndex < gaps.length && (gaps[gapIndex]?.end ?? 0) <= activity.start) {
      const gap = gaps[gapIndex]!;
      rows.push(<GapRow key={`gap-${gap.start}`} minutes={gap.minutes} />);
      gapIndex += 1;
    }
    rows.push(
      <ActivityCard
        key={identityKey(activity.identity)}
        activity={activity}
        selected={identityKey(activity.identity) === selectedKey}
        onSelect={onSelect}
      />,
    );
  }
  while (gapIndex < gaps.length) {
    const gap = gaps[gapIndex]!;
    rows.push(<GapRow key={`gap-${gap.start}`} minutes={gap.minutes} />);
    gapIndex += 1;
  }

  return (
    <main className="timeline">
      <div className="panel-head">
        <h2>今日日程</h2>
        <span className="hint">纵向位置＝开始时刻 · 空白＝空闲 · 数字是准确时长</span>
      </div>
      {rows.length ? rows : <div className="empty">这一天还没有活动。点「＋ 添加」开始。</div>}
    </main>
  );
}

function GapRow({ minutes }: { minutes: number }) {
  const height = Math.max(GAP_MIN_PX, minutes * PX_PER_MINUTE);
  return (
    <div className="gap" style={{ height }} data-testid="gap">
      <span>空闲 {formatDuration(minutes)}</span>
    </div>
  );
}

function ActivityCard({
  activity,
  selected,
  onSelect,
}: {
  activity: Activity;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  const range = activityRange(activity);
  const over = range.end - DAY_END;
  const key = identityKey(activity.identity);
  return (
    <button
      type="button"
      className={`card${selected ? ' selected' : ''}`}
      onClick={() => onSelect(key)}
      data-testid="activity-card"
    >
      <span className="card-time">{formatTime(activity.start)}</span>
      <span className="card-body">
        <span className="card-title">{activity.name}</span>
        <span className="card-meta">
          {formatTime(range.start)} – {formatTime(range.end)} · {formatDuration(activity.duration)}
        </span>
      </span>
      {over > 0 ? <span className="tag warn">超出游戏日 {formatDuration(over)}</span> : null}
    </button>
  );
}
