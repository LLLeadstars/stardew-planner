// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { identityKey } from '../../src/core';
import type { GameDate } from '../../src/core';
import { Timeline } from '../../src/ui/Timeline';
import { makeActivity } from '../helpers';

// React 18 要求测试环境显式声明，否则 act 会告警。
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RECT = { top: 0, height: 40, bottom: 40, left: 0, right: 100, width: 100, x: 0, y: 0 };

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

function mount(
  activities: ReturnType<typeof makeActivity>[],
  playerStates = {},
  currentDay: GameDate = { year: 1, season: 0, day: 3 },
) {
  const onMove = vi.fn();
  const onSwap = vi.fn();
  const onSelect = vi.fn();
  act(() => {
    root.render(
      <Timeline
        activities={activities}
        currentDay={currentDay}
        playerStates={playerStates}
        selectedKey={null}
        onSelect={onSelect}
        onMove={onMove}
        onSwap={onSwap}
      />,
    );
  });
  return { onMove, onSwap, onSelect };
}

function cards(): HTMLDivElement[] {
  return Array.from(container.querySelectorAll<HTMLDivElement>('[data-testid="activity-card"]'));
}

function dragEvent(type: string, clientY: number) {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
}

describe('时间轴卡片渲染与交换', () => {
  it('按开始时刻渲染卡片，并提供 ↑↓ 交换按钮', () => {
    const { onSwap } = mount([
      makeActivity({ id: 'a', start: 360, duration: 60, name: '甲' }),
      makeActivity({ id: 'b', start: 600, duration: 60, name: '乙' }),
    ]);
    const rendered = cards();
    expect(rendered).toHaveLength(2);
    expect(rendered[0]?.textContent).toContain('甲');
    expect(rendered[1]?.textContent).toContain('乙');

    act(() => {
      rendered[0]
        ?.querySelector('button[aria-label="与下一项交换开始时刻"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSwap).toHaveBeenCalledWith(identityKey({ kind: 'manual', id: 'a' }), 'down');
  });
});

describe('活动卡片上的玩家状态摘要', () => {
  it('购物卡片显示依赖状态的当前取值，状态修改后随之更新', () => {
    mount([makeActivity({ id: 'shop', start: 540, duration: 60, activityType: 'shop' })], {});
    expect(container.textContent).toContain('社区中心状态：未填写 · 城镇钥匙：未填写');
    act(() => {
      root.render(
        <Timeline
          activities={[makeActivity({ id: 'shop', start: 540, duration: 60, activityType: 'shop' })]}
          currentDay={{ year: 1, season: 0, day: 3 }}
          playerStates={{ communityCenter: 'restored', townKey: 'no' }}
          selectedKey={null}
          onSelect={() => {}}
          onMove={() => {}}
          onSwap={() => {}}
        />,
      );
    });
    expect(container.textContent).toContain('社区中心状态：已修复 · 城镇钥匙：未持有');
  });

  it('不依赖玩家状态的卡片没有摘要行', () => {
    mount([makeActivity({ id: 'a', start: 360, duration: 60, activityType: 'custom' })]);
    expect(container.querySelector('[data-testid="activity-state-summary"]')).toBeNull();
  });
});

describe('活动卡片上的门店判定', () => {
  it('已选门店的购物卡片把建筑可进入与服务可交易分开显示，并保留未知的黄色结论', () => {
    mount(
      [
        makeActivity({
          id: 'shop',
          start: 540,
          duration: 60,
          activityType: 'shop',
          details: { shop: 'pierre' },
        }),
      ],
      {},
    );
    expect(container.textContent).toContain('建筑可进入：暂按不可用');
    expect(container.textContent).toContain('服务可交易：暂按不可用');
    expect(container.querySelector('[data-testid="activity-state-summary"]')).toBeNull();
  });

  it('普通周二木匠商店显示红色确认关闭，同时给出黄色柜台技巧', () => {
    mount(
      [
        makeActivity({
          id: 'shop',
          start: 540,
          duration: 60,
          activityType: 'shop',
          details: { shop: 'carpenter' },
        }),
      ],
      { weather: 'sunny' },
      { year: 1, season: 0, day: 2 },
    );
    const service = container.querySelector('[data-testid="shop-service"]');
    expect(service?.textContent).toContain('确认关闭');
    expect(service?.className).toContain('closed');
    const tip = container.querySelector('[data-testid="shop-tip"]');
    expect(tip?.textContent).toContain('9:40');
    expect(tip?.className).toContain('tips');
  });
});

describe('拖动落点与高亮', () => {
  function setupDrag() {
    const dragged = makeActivity({ id: 'moved', start: 480, duration: 60 });
    const target = makeActivity({ id: 'target', start: 600, duration: 60 });
    const utils = mount([dragged, target]);
    const draggedCard = cards()[0]!;
    const targetCard = cards()[1]!;
    targetCard.getBoundingClientRect = () => RECT as DOMRect;
    act(() => {
      draggedCard.dispatchEvent(new Event('dragstart', { bubbles: true }));
    });
    return { ...utils, targetCard };
  }

  it('卡片上半＝紧贴其前，并高亮上半', () => {
    const { onMove, targetCard } = setupDrag();
    act(() => {
      targetCard.dispatchEvent(dragEvent('dragover', 5));
    });
    expect(targetCard.className).toContain('drop-before');
    act(() => {
      targetCard.dispatchEvent(dragEvent('drop', 5));
    });
    expect(onMove).toHaveBeenCalledWith(identityKey({ kind: 'manual', id: 'moved' }), 540); // 600 - 60
  });

  it('卡片下半＝紧贴其后，并高亮下半', () => {
    const { onMove, targetCard } = setupDrag();
    act(() => {
      targetCard.dispatchEvent(dragEvent('dragover', 35));
    });
    expect(targetCard.className).toContain('drop-after');
    act(() => {
      targetCard.dispatchEvent(dragEvent('drop', 35));
    });
    expect(onMove).toHaveBeenCalledWith(identityKey({ kind: 'manual', id: 'moved' }), 660); // 600 + 60
  });

  it('落在空闲区段时高亮空白并取该空闲时段的起点', () => {
    const { onMove } = setupDrag();
    const gap = container.querySelector<HTMLDivElement>('[data-testid="gap"]')!;
    act(() => {
      gap.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    });
    expect(gap.className).toContain('drop-target');
    act(() => {
      gap.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    });
    // 唯一空闲是 06:00–08:00（拖动中的活动被计入占用），其起点为 06:00。
    expect(onMove).toHaveBeenCalledWith(identityKey({ kind: 'manual', id: 'moved' }), 360);
  });
});
