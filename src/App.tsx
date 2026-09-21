import { useMemo, useState } from 'react';
import { firstFreeStart, freeGaps, identityKey, manualIdentity, overruns } from './core';
import type { ActivityPatch } from './core';
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

  function handleAdd(name: string, duration: number) {
    const id = newManualId();
    dispatch({
      kind: 'addActivity',
      identity: manualIdentity(id),
      name,
      start: firstFreeStart(activities),
      duration,
    });
    setSelectedKey(identityKey(manualIdentity(id)));
    setAddOpen(false);
  }

  function handlePatch(patch: ActivityPatch) {
    if (!selected) return;
    dispatch({ kind: 'editActivity', key: identityKey(selected.identity), patch });
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
        <Timeline activities={activities} selectedKey={selectedKey} onSelect={setSelectedKey} />
        <Inspector activity={selected} onPatch={handlePatch} onDelete={handleDelete} />
      </div>
      {addOpen ? <AddActivityDialog onCancel={() => setAddOpen(false)} onSubmit={handleAdd} /> : null}
    </div>
  );
}

function noticeFor(loadOutcome: LoadOutcome): string | undefined {
  if (loadOutcome.status !== 'rejected') return undefined;
  return loadOutcome.reason === 'future-version'
    ? '本地数据来自更新的格式版本，已忽略；继续会覆盖它。'
    : '本地数据无法读取，已忽略；继续会覆盖它。';
}
