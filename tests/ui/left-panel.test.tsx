// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity, PlayerStateCommand, PlayerStates } from '../../src/core';
import { LeftPanel } from '../../src/ui/LeftPanel';
import { makeActivity } from '../helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function mount(options: {
  activities?: Activity[];
  playerStates?: PlayerStates;
  collapsed?: boolean;
  onToggle?: () => void;
  onSetState?: (command: PlayerStateCommand) => void;
}) {
  const onToggle = options.onToggle ?? vi.fn();
  const onSetState = options.onSetState ?? vi.fn();
  act(() => {
    root.render(
      <LeftPanel
        currentDay={{ year: 1, season: 0, day: 3 }}
        mode="single"
        activities={options.activities ?? []}
        playerStates={options.playerStates ?? {}}
        activityCount={(options.activities ?? []).length}
        gapCount={1}
        overrunCount={0}
        collapsed={options.collapsed ?? false}
        onToggle={onToggle}
        onSetState={onSetState}
      />,
    );
  });
  return { onToggle, onSetState };
}

function select(name: string): HTMLSelectElement {
  return container.querySelector<HTMLSelectElement>(`select[data-field="${name}"]`)!;
}

function choose(element: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('左栏：今天的前提', () => {
  it('展示游戏日、模式与可修改的天气/特殊日', () => {
    const { onSetState } = mount({});
    expect(container.textContent).toContain('第 1 年 春 3 日');
    expect(container.textContent).toContain('单人');
    choose(select('weather'), 'rain');
    expect(onSetState).toHaveBeenCalledWith({ kind: 'setWeather', value: 'rain' });
    choose(select('specialDay'), 'festival');
    expect(onSetState).toHaveBeenCalledWith({ kind: 'setSpecialDay', value: 'festival' });
  });
});

describe('左栏：影响本日的玩家状态', () => {
  it('没有活动时明确说明不依赖任何玩家状态', () => {
    mount({});
    expect(container.textContent).toContain('本日的活动不依赖任何玩家状态');
  });

  it('购物活动让社区中心与城镇钥匙出现，并带一句影响说明', () => {
    mount({ activities: [makeActivity({ start: 540, duration: 60, activityType: 'shop' })] });
    expect(container.textContent).toContain('社区中心状态');
    expect(container.textContent).toContain('城镇钥匙');
    expect(container.textContent).toContain('影响皮埃尔杂货店');
    expect(container.textContent).not.toContain('工具等级');
  });

  it('未依赖的状态不占用左栏', () => {
    mount({ activities: [makeActivity({ start: 540, duration: 60, activityType: 'custom' })] });
    expect(container.textContent).not.toContain('社区中心状态');
    expect(container.textContent).toContain('本日的活动不依赖任何玩家状态');
  });

  it('就地修改已显示的状态会写回，并更新影响说明', () => {
    const activities = [makeActivity({ start: 540, duration: 60, activityType: 'shop' })];
    const { onSetState } = mount({ activities, playerStates: { communityCenter: 'restored' } });
    expect(container.textContent).toContain('已修复');
    choose(select('communityCenter'), 'notRestored');
    expect(onSetState).toHaveBeenCalledWith({ kind: 'setCommunityCenter', value: 'notRestored' });
  });

  it('工具活动显示工具等级，并可按工具修改', () => {
    const activities = [makeActivity({ start: 540, duration: 60, activityType: 'toolGive' })];
    const { onSetState } = mount({ activities });
    const toolSelect = container.querySelector<HTMLSelectElement>('select[data-tool="can"]')!;
    expect(toolSelect).toBeTruthy();
    choose(toolSelect, 'copper');
    expect(onSetState).toHaveBeenCalledWith({ kind: 'setToolLevel', tool: 'can', level: 'copper' });
  });
});

describe('左栏：可收起', () => {
  it('收起后给出展开入口', () => {
    const { onToggle } = mount({ collapsed: true });
    const button = container.querySelector('button')!;
    expect(container.textContent).not.toContain('今天的前提');
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onToggle).toHaveBeenCalled();
  });
});
