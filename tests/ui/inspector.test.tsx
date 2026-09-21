// @vitest-environment jsdom
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityPatch, ActivityType } from '../../src/core';
import { Inspector } from '../../src/ui/Inspector';
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

function mount(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

function field(name: string): HTMLInputElement | HTMLTextAreaElement {
  return container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-field="${name}"]`)!;
}

function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('检查器：时长来源与个人默认', () => {
  it('展示解析链上的个人默认、最近一次预留与系统推荐预留', () => {
    mount(
      <Inspector
        activity={makeActivity({ id: 'a', start: 360, duration: 80 })}
        preferences={{ personal: { custom: 90 }, last: { custom: 40 } }}
        onPatch={() => {}}
        onSaveDefault={() => {}}
        onDelete={() => {}}
      />,
    );
    const hint = container.textContent ?? '';
    expect(hint).toContain('1 小时 30 分钟'); // 个人默认 90
    expect(hint).toContain('40 分钟'); // 最近一次预留
    expect(hint).toContain('30 分钟'); // 系统推荐预留
  });

  it('点击「保存为个人默认」把当前时长与活动类型交给应用层', () => {
    const onSaveDefault = vi.fn<(activityType: ActivityType, minutes: number) => void>();
    mount(
      <Inspector
        activity={makeActivity({ id: 'a', start: 360, duration: 80 })}
        preferences={{ personal: {}, last: {} }}
        onPatch={() => {}}
        onSaveDefault={onSaveDefault}
        onDelete={() => {}}
      />,
    );
    const button = Array.from(container.querySelectorAll('button')).find((element) =>
      element.textContent?.includes('保存为个人默认'),
    );
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSaveDefault).toHaveBeenCalledWith('custom', 80);
  });
});

describe('检查器：当次相关字段', () => {
  it('编辑备注与清单后交给应用层', () => {
    const onPatch = vi.fn<(patch: ActivityPatch) => void>();
    mount(
      <Inspector
        activity={makeActivity({ id: 'a', start: 360, duration: 60, note: '旧备注', checklist: ['甲'] })}
        preferences={{ personal: {}, last: {} }}
        onPatch={onPatch}
        onSaveDefault={() => {}}
        onDelete={() => {}}
      />,
    );
    setValue(field('note'), '新备注');
    expect(onPatch).toHaveBeenCalledWith({ note: '新备注' });

    onPatch.mockClear();
    setValue(field('checklist'), '甲\n乙\n丙');
    expect(onPatch).toHaveBeenCalledWith({ checklist: ['甲', '乙', '丙'] });
  });

  it('赶路显示起点与终点，编辑其一保留另一个', () => {
    const onPatch = vi.fn<(patch: ActivityPatch) => void>();
    mount(
      <Inspector
        activity={makeActivity({
          id: 'a',
          start: 360,
          duration: 60,
          activityType: 'travel',
          details: { from: '农场', to: '镇上' },
        })}
        preferences={{ personal: {}, last: {} }}
        onPatch={onPatch}
        onSaveDefault={() => {}}
        onDelete={() => {}}
      />,
    );
    setValue(field('from'), '矿区');
    expect(onPatch).toHaveBeenCalledWith({ details: { from: '矿区', to: '镇上' } });
  });

  it('钓鱼显示地点与自由文本目标，编辑目标保留地点', () => {
    const onPatch = vi.fn<(patch: ActivityPatch) => void>();
    mount(
      <Inspector
        activity={makeActivity({
          id: 'a',
          start: 360,
          duration: 120,
          activityType: 'fishing',
          details: { place: '山湖' },
        })}
        preferences={{ personal: {}, last: {} }}
        onPatch={onPatch}
        onSaveDefault={() => {}}
        onDelete={() => {}}
      />,
    );
    setValue(field('target'), '钓 5 条鲈鱼');
    expect(onPatch).toHaveBeenCalledWith({ details: { place: '山湖', target: '钓 5 条鲈鱼' } });
  });

  it('非赶路/钓鱼/采矿活动不出现这些字段', () => {
    mount(
      <Inspector
        activity={makeActivity({ id: 'a', start: 360, duration: 60, activityType: 'water' })}
        preferences={{ personal: {}, last: {} }}
        onPatch={() => {}}
        onSaveDefault={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(container.querySelector('[data-field="from"]')).toBeNull();
    expect(container.querySelector('[data-field="place"]')).toBeNull();
    expect(container.querySelector('[data-field="note"]')).not.toBeNull();
  });
});
