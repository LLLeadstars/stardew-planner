// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createPlannerState,
  manualIdentity,
  reducePlanner,
  serializeState,
} from '../../src/core';
import type { PlannerState } from '../../src/core';
import { STORAGE_KEY } from '../../src/storage/port';
import { App } from '../../src/App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const day = { year: 1, season: 0, day: 3 } as const;

function sampleState(): PlannerState {
  return reducePlanner(createPlannerState(day, 'single'), {
    kind: 'addActivity',
    identity: manualIdentity('a'),
    activityType: 'custom',
    name: '看电视',
    start: 370,
    duration: 10,
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
});

function click(action: string) {
  act(() => {
    container.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  });
}

function text(): string {
  return container.textContent ?? '';
}

describe('存储面板：清空后重新导入备份', () => {
  it('清空回到首次使用，导入预览确认后领域数据一致恢复', async () => {
    const backup = serializeState(sampleState());
    window.localStorage.setItem(STORAGE_KEY, backup);

    act(() => root.render(<App />));
    expect(text()).toContain('看电视');

    click('open-storage');
    click('clear');
    click('confirm-clear');

    expect(text()).toContain('首次使用只问当前游戏日与游戏模式');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    click('open-storage');
    const input = container.querySelector<HTMLInputElement>('[data-field="import-file"]')!;
    const file = new File([backup], 'backup.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(container.querySelector('[data-status="ok"]')).not.toBeNull();
    expect(text()).toContain('第 1 年 春 3 日');

    click('confirm-import');
    expect(text()).toContain('看电视');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(backup);
  });
});
