import { useMemo, useState } from 'react';
import {
  firstFreeStart,
  freeGaps,
  identityKey,
  manualIdentity,
  overruns,
  swapAdjacentStarts,
} from './core';
import type { ActivityPatch, ActivityType, GameMinutes, NewCropBatchFields, SwapDirection } from './core';
import { newManualId, usePlanner } from './app/usePlanner';
import type { LoadOutcome } from './storage/port';
import { AddActivityDialog } from './ui/AddActivityDialog';
import type { ActivityDraft } from './ui/AddActivityDialog';
import { ActivityTypePicker } from './ui/ActivityTypePicker';
import { Inspector } from './ui/Inspector';
import { LeftPanel } from './ui/LeftPanel';
import { SetupScreen } from './ui/SetupScreen';
import { StoragePanel } from './ui/StoragePanel';
import { Timeline } from './ui/Timeline';
import { TopBar } from './ui/TopBar';

export function App() {
  const { state, loadOutcome, start, dispatch, replace, clear } = usePlanner();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<ActivityType | null>(null);
  const [storageOpen, setStorageOpen] = useState(false);

  const activities = state?.activities ?? [];
  const currentDay = state?.currentDay;
  const gaps = useMemo(() => freeGaps(activities), [activities]);
  const overrunCount = useMemo(() => overruns(activities).length, [activities]);
  const selected = selectedKey
    ? activities.find((activity) => identityKey(activity.identity) === selectedKey) ?? null
    : null;

  if (!state) {
    return (
      <>
        <SetupScreen
          notice={noticeFor(loadOutcome)}
          onStart={(day, mode) => start(day, mode)}
          onOpenStorage={() => setStorageOpen(true)}
        />
        {storageOpen ? (
          <StoragePanel
            state={null}
            onImport={replace}
            onClear={clear}
            onClose={() => setStorageOpen(false)}
          />
        ) : null}
      </>
    );
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
      crop: draft.crop ? { id: newManualId(), ...draft.crop } : undefined,
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

  function handleUpdateBatch(batchId: string, patch: Partial<NewCropBatchFields>) {
    dispatch({ kind: 'updateCropBatch', batchId, patch });
  }

  function handleRecordSupply(batchId: string, wateredCount: number) {
    if (!currentDay) return;
    dispatch({
      kind: 'recordCropSupply',
      batchId,
      date: currentDay,
      wateredCount,
      splitId: newManualId(),
    });
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
      <TopBar
        currentDay={state.currentDay}
        mode={state.mode}
        onAdd={() => setAddOpen(true)}
        onOpenStorage={() => setStorageOpen(true)}
      />
      <div className="columns">
        <LeftPanel
          currentDay={state.currentDay}
          mode={state.mode}
          activities={activities}
          playerStates={state.playerStates}
          activityCount={activities.length}
          gapCount={gaps.length}
          overrunCount={overrunCount}
          collapsed={leftCollapsed}
          onToggle={() => setLeftCollapsed((value) => !value)}
          onSetState={dispatch}
        />
        <Timeline
          activities={activities}
          currentDay={state.currentDay}
          playerStates={state.playerStates}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onMove={handleMove}
          onSwap={handleSwap}
        />
        <Inspector
          activity={selected}
          currentDay={state.currentDay}
          playerStates={state.playerStates}
          preferences={state.reserves}
          toolUpgrade={state.toolUpgrade}
          cropBatches={state.cropBatches}
          onPatch={handlePatch}
          onSaveDefault={handleSaveDefault}
          onDelete={handleDelete}
          onToggleCompleted={handleToggleCompleted}
          onUpdateBatch={handleUpdateBatch}
          onRecordSupply={handleRecordSupply}
          onSetState={dispatch}
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
      {storageOpen ? (
        <StoragePanel
          state={state}
          onImport={replace}
          onClear={clear}
          onClose={() => setStorageOpen(false)}
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
