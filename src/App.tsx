import { useMemo, useState } from 'react';
import {
  firstFreeStart,
  freeGaps,
  identityKey,
  manualIdentity,
  overruns,
  swapAdjacentStarts,
} from './core';
import type { ActivityPatch, ActivityType, GameMinutes, SwapDirection } from './core';
import { newManualId, usePlanner } from './app/usePlanner';
import type { LoadOutcome } from './storage/port';
import { AddActivityDialog } from './ui/AddActivityDialog';
import { Inspector } from './ui/Inspector';
import { LeftPanel } from './ui/LeftPanel';
import { SetupScreen } from './ui/SetupScreen';
import { Timeline } from './ui/Timeline';
import { TopBar } from './ui/TopBar';

export function App() {
  const { state, loadOutcome, start, dispatch } = usePlanner();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const activities = state?.activities ?? [];
  const gaps = useMemo(() => freeGaps(activities), [activities]);
  const overrunCount = useMemo(() => overruns(activities).length, [activities]);
  const selected = selectedKey
    ? activities.find((activity) => identityKey(activity.identity) === selectedKey) ?? null
    : null;

  if (!state) {
    return <SetupScreen notice={noticeFor(loadOutcome)} onStart={(day, mode) => start(day, mode)} />;
  }

  function handleAdd(name: string, duration?: number) {
    const id = newManualId();
    const identity = manualIdentity(id);
    dispatch({
      kind: 'addActivity',
      identity,
      activityType: 'custom',
      name,
      start: firstFreeStart(activities),
      duration,
    });
    setSelectedKey(identityKey(identity));
    setAddOpen(false);
  }

  function handlePatch(patch: ActivityPatch) {
    if (!selected) return;
    dispatch({ kind: 'editActivity', key: identityKey(selected.identity), patch });
  }

  function handleMove(key: string, start: GameMinutes) {
    dispatch({ kind: 'editActivity', key, patch: { start } });
  }

  /** 交换相邻两项的开始时刻：两条补丁只改 start，时长与内容不动。 */
  function handleSwap(key: string, direction: SwapDirection) {
    for (const patch of swapAdjacentStarts(activities, key, direction)) {
      dispatch({ kind: 'editActivity', key: patch.key, patch: { start: patch.start } });
    }
  }

  function handleSaveDefault(activityType: ActivityType, minutes: number) {
    dispatch({ kind: 'savePersonalReserve', activityType, minutes });
  }

  function handleDelete() {
    if (!selected) return;
    dispatch({ kind: 'deleteActivity', key: identityKey(selected.identity) });
    setSelectedKey(null);
  }

  return (
    <div className="app">
      <TopBar currentDay={state.currentDay} mode={state.mode} onAdd={() => setAddOpen(true)} />
      <div className="columns">
        <LeftPanel
          currentDay={state.currentDay}
          mode={state.mode}
          activityCount={activities.length}
          gapCount={gaps.length}
          overrunCount={overrunCount}
          collapsed={leftCollapsed}
          onToggle={() => setLeftCollapsed((value) => !value)}
        />
        <Timeline
          activities={activities}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onMove={handleMove}
          onSwap={handleSwap}
        />
        <Inspector
          activity={selected}
          preferences={state.reserves}
          onPatch={handlePatch}
          onSaveDefault={handleSaveDefault}
          onDelete={handleDelete}
        />
      </div>
      {addOpen ? (
        <AddActivityDialog
          activityType="custom"
          preferences={state.reserves}
          onCancel={() => setAddOpen(false)}
          onSubmit={handleAdd}
        />
      ) : null}
    </div>
  );
}

function noticeFor(loadOutcome: LoadOutcome): string | undefined {
  if (loadOutcome.status !== 'rejected') return undefined;
  return loadOutcome.reason === 'future-version'
    ? '本地数据来自更新的格式版本，已忽略；继续会覆盖它。'
    : '本地数据无法读取，已忽略；继续会覆盖它。';
}
