// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_VERSION,
  createPlannerState,
  manualIdentity,
  reducePlanner,
  serializeState,
} from '../../src/core';
import type { PlannerState } from '../../src/core';
import { StoragePanel } from '../../src/ui/StoragePanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const day = { year: 1, season: 0, day: 3 } as const;

function sampleState(): PlannerState {
  let state = createPlannerState(day, 'single');
  state = reducePlanner(state, {
    kind: 'addActivity',
    identity: manualIdentity('a'),
    activityType: 'custom',
    name: '看电视',
    start: 370,
    duration: 10,
  });
  state = reducePlanner(state, { kind: 'setWeather', value: 'rain' });
  return state;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

type Handlers = {
  onImport?: (state: PlannerState) => void;
  onClear?: () => void;
  onClose?: () => void;
  saveFile?: (filename: string, text: string) => void;
  readFile?: (file: File) => Promise<string>;
};

function mount(state: PlannerState | null, handlers: Handlers = {}) {
  act(() => {
    root.render(
      <StoragePanel
        state={state}
        onImport={handlers.onImport ?? (() => {})}
        onClear={handlers.onClear ?? (() => {})}
        onClose={handlers.onClose ?? (() => {})}
        saveFile={handlers.saveFile}
        readFile={handlers.readFile}
      />,
    );
  });
}

function click(action: string) {
  act(() => {
    container.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  });
}

async function pickFile(name: string, text: string) {
  const input = container.querySelector<HTMLInputElement>('[data-field="import-file"]')!;
  const file = new File([text], name, { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
  });
}

function text(): string {
  return container.textContent ?? '';
}

describe('存储面板：导出', () => {
  it('导出带版本号的 JSON，文件名用当前游戏日', () => {
    const saveFile = vi.fn<(filename: string, text: string) => void>();
    mount(sampleState(), { saveFile });
    click('export');
    expect(saveFile).toHaveBeenCalledTimes(1);
    const [filename, payload] = saveFile.mock.calls[0]!;
    expect(filename).toBe('stardew-planner-1-0-3.json');
    expect(payload).toContain(`"version":${STORAGE_VERSION}`);
    expect(payload).toContain('看电视');
    expect(payload).not.toContain('selectedKey');
  });

  it('没有状态时不提供导出与清空', () => {
    mount(null);
    expect(container.querySelector('[data-action="export"]')).toBeNull();
    expect(container.querySelector('[data-action="clear"]')).toBeNull();
    expect(container.querySelector('[data-field="import-file"]')).not.toBeNull();
  });
});

describe('存储面板：导入预览与二次确认', () => {
  it('选中文件先显示预览，确认后才替换', async () => {
    const onImport = vi.fn<(state: PlannerState) => void>();
    const next = sampleState();
    mount(null, { onImport, readFile: () => Promise.resolve(serializeState(next)) });

    await pickFile('backup.json', '');
    expect(container.querySelector('[data-status="ok"]')).not.toBeNull();
    expect(text()).toContain('第 1 年 春 3 日');
    expect(text()).toContain('来自 backup.json');
    expect(onImport).not.toHaveBeenCalled();

    click('confirm-import');
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0]![0]).toEqual(next);
  });

  it('旧格式预览说明将自动迁移', async () => {
    const legacy = JSON.stringify({
      version: 1,
      state: {
        currentDay: day,
        mode: 'single',
        activities: [
          {
            identity: { kind: 'manual', id: 'a' },
            name: '看电视',
            start: 370,
            duration: 10,
            protection: { editedByPlayer: false, completed: false },
          },
        ],
      },
    });
    mount(null, { readFile: () => Promise.resolve(legacy) });
    await pickFile('old.json', '');
    expect(text()).toContain(`将自动迁移到 v${STORAGE_VERSION}`);
  });
});

describe('存储面板：拒绝非法文件', () => {
  it('损坏文件被拒绝且不替换现有数据', async () => {
    const onImport = vi.fn<(state: PlannerState) => void>();
    mount(sampleState(), { onImport, readFile: () => Promise.resolve('{不是 JSON') });
    await pickFile('broken.json', '');
    expect(container.querySelector('[data-status="rejected"]')).not.toBeNull();
    expect(text()).toContain('现有数据保持不变');
    expect(container.querySelector('[data-action="confirm-import"]')).toBeNull();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('未来格式版本被拒绝', async () => {
    mount(null, {
      readFile: () => Promise.resolve(JSON.stringify({ version: 999, state: sampleState() })),
    });
    await pickFile('future.json', '');
    expect(container.querySelector('[data-status="rejected"]')).not.toBeNull();
    expect(text()).toContain('更新的格式版本');
  });

  it('读取文件失败按损坏处理', async () => {
    mount(null, { readFile: () => Promise.reject(new Error('读取失败')) });
    await pickFile('unreadable.json', '');
    expect(container.querySelector('[data-status="rejected"]')).not.toBeNull();
  });
});

describe('存储面板：清空需要确认', () => {
  it('点击清空先确认，确认后才回调', () => {
    const onClear = vi.fn();
    mount(sampleState(), { onClear });
    click('clear');
    expect(onClear).not.toHaveBeenCalled();
    expect(text()).toContain('无法撤销');
    click('confirm-clear');
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
