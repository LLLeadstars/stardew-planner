import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameDate, GameMode, PlannerCommand, PlannerState } from '../core';
import { createPlannerState, reducePlanner } from '../core';
import { createBrowserStoragePort } from '../storage/localStorage';
import type { LoadOutcome } from '../storage/port';

export type PlannerController = {
  state: PlannerState | null;
  loadOutcome: LoadOutcome;
  start: (day: GameDate, mode: GameMode) => void;
  dispatch: (command: PlannerCommand) => void;
};

/**
 * 应用服务：把纯核心与存储端口接起来。
 * 每次状态变更即时写入本地存储，界面只读状态、只发命令。
 */
export function usePlanner(): PlannerController {
  const port = useMemo(() => createBrowserStoragePort(), []);
  const [loadOutcome] = useState<LoadOutcome>(() => port.load());
  const [state, setState] = useState<PlannerState | null>(() =>
    loadOutcome.status === 'ok' ? loadOutcome.state : null,
  );

  useEffect(() => {
    if (state) port.save(state);
  }, [port, state]);

  const start = useCallback((day: GameDate, mode: GameMode) => {
    setState(createPlannerState(day, mode));
  }, []);

  const dispatch = useCallback((command: PlannerCommand) => {
    setState((previous) => (previous ? reducePlanner(previous, command) : previous));
  }, []);

  return { state, loadOutcome, start, dispatch };
}

export function newManualId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
