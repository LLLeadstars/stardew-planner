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
import type { ActivityDraft } from './ui/AddActivityDialog';
import { ActivityTypePicker } from './ui/ActivityTypePicker';
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
  const [addType, setAddType] = useState<ActivityType | null>(null);

  const activities = state?.activities ?? [];
  const gaps = useMemo(() => freeGaps(activities), [activities]);
  const overrunCount = useMemo(() => overruns(activities).length, [activities]);
  const selected = selectedKey
    ? activities.find((activity) => identityKey(activity.identity) === selectedKey) ?? null
    : null;

  if (!state) {
    return <SetupScreen notice={noticeFor(loadOutcome)} onStart={(day, mode) => start(day, mode)} />;
  }

  function closeAdd() {
    setAddOpen(false);
    setAddType(null);
  }

  function handleAdd(draft: ActivityDraft) {
    if (!addType) return;
    const id = newManualId();
    const identity = manualIdentity(id);
    dispatch({
      kind: 'addActivity',
      identity,
      activityType: addType,
      name: draft.name,
      start: firstFreeStart(activities),
      duration: draft.duration,
      note: draft.note,
      checklist: draft.checklist,
      details: draft.details,
    });
    setSelectedKey(identityKey(identity));
    closeAdd();
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

  function handleToggleCompleted(completed: boolean) {
    if (!selected) return;
    dispatch({ kind: 'toggleActivityCompleted', key: identityKey(selected.identity), completed });
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
          onToggleCompleted={handleToggleCompleted}
        />
      </div>
      {addOpen && addType === null ? (
        <ActivityTypePicker onSelect={(type) => setAddType(type)} onCancel={closeAdd} />
      ) : null}
      {addOpen && addType !== null ? (
        <AddActivityDialog
          activityType={addType}
          preferences={state.reserves}
          onCancel={closeAdd}
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
