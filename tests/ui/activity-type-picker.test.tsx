// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityType } from '../../src/core';
import { ActivityTypePicker } from '../../src/ui/ActivityTypePicker';

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

function options(): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-testid="activity-type-option"]'));
}

function mount(onSelect: (type: ActivityType) => void = () => {}) {
  act(() => {
    root.render(<ActivityTypePicker onSelect={onSelect} onCancel={() => {}} />);
  });
}

describe('类型弹层', () => {
  it('列出九种内置活动与自定义活动，且没有常驻添加托盘', () => {
    mount();
    const labels = options().map((option) => option.textContent ?? '');
    expect(labels).toHaveLength(10);
    for (const expected of [
      '种植',
      '浇水',
      '收获',
      '购物',
      '工具升级交付',
      '工具取回',
      '赶路',
      '钓鱼',
      '采矿',
      '自定义活动',
    ]) {
      expect(labels.some((label) => label.includes(expected))).toBe(true);
    }
  });

  it('每个内置活动显示与规格一致的系统推荐预留，且表述为可编辑起点', () => {
    mount();
    const byType = (type: string) =>
      container.querySelector<HTMLElement>(`[data-activity-type="${type}"]`)?.textContent ?? '';
    expect(byType('plant')).toContain('1 小时');
    expect(byType('fishing')).toContain('2 小时');
    expect(byType('custom')).toContain('30 分钟');
    expect(options()[0]?.textContent).toContain('规划起点');
    expect(container.textContent).not.toContain('系统估算');
  });

  it('选择类型后把该类型交给应用层', () => {
    const onSelect = vi.fn<(type: ActivityType) => void>();
    mount(onSelect);
    const travel = container.querySelector<HTMLElement>('[data-activity-type="travel"]')!;
    act(() => {
      travel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith('travel');
  });
});
