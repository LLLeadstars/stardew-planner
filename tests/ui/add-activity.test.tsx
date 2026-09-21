// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityType } from '../../src/core';
import type { ActivityDraft } from '../../src/ui/AddActivityDialog';
import { AddActivityDialog } from '../../src/ui/AddActivityDialog';

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

function mount(
  activityType: ActivityType,
  preferences = { personal: {}, last: {} },
  onSubmit: (draft: ActivityDraft) => void = () => {},
) {
  act(() => {
    root.render(
      <AddActivityDialog
        activityType={activityType}
        preferences={preferences}
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    );
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

function submit() {
  act(() => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('添加内置活动：最少参数即可保存', () => {
  it('八类内置活动只选类型、不改任何字段也能提交，名称落到类型名', () => {
    for (const type of ['plant', 'water', 'harvest', 'shop', 'toolGive', 'toolTake', 'travel', 'fishing', 'mining'] as const) {
      const onSubmit = vi.fn<(draft: ActivityDraft) => void>();
      mount(type, { personal: {}, last: {} }, onSubmit);
      submit();
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const draft = onSubmit.mock.calls[0]![0];
      expect(draft.name.length).toBeGreaterThan(0);
      expect(draft.duration).toBeUndefined(); // 让 reducer 走解析链
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it('自定义活动名称留空时落到「自定义活动」', () => {
    const onSubmit = vi.fn<(draft: ActivityDraft) => void>();
    mount('custom', { personal: {}, last: {} }, onSubmit);
    submit();
    expect(onSubmit.mock.calls[0]![0].name).toBe('自定义活动');
  });

  it('系统推荐预留作为预填值展示，并表述为可编辑的规划起点', () => {
    mount('fishing');
    expect(field('duration')).toHaveProperty('value', '120');
    const text = container.textContent ?? '';
    expect(text).toContain('可编辑的规划起点');
    expect(text).toContain('不是对活动成果的预测');
    expect(text).not.toContain('系统估算');
  });

  it('改动时长后作为当前手填值提交', () => {
    const onSubmit = vi.fn<(draft: ActivityDraft) => void>();
    mount('custom', { personal: { custom: 90 }, last: {} }, onSubmit);
    setValue(field('duration'), '40');
    submit();
    expect(onSubmit.mock.calls[0]![0].duration).toBe(40);
  });
});

describe('添加内置活动：当次相关字段', () => {
  it('赶路可填起点与终点，并明确不估算路线', () => {
    const onSubmit = vi.fn<(draft: ActivityDraft) => void>();
    mount('travel', { personal: {}, last: {} }, onSubmit);
    setValue(field('from'), '农场');
    setValue(field('to'), '铁匠铺');
    submit();
    expect(onSubmit.mock.calls[0]![0].details).toEqual({ from: '农场', to: '铁匠铺' });
    expect(container.textContent).toContain('不估算路线');
  });

  it('钓鱼与采矿可填地点与自由文本目标，且不承诺产出', () => {
    const onSubmit = vi.fn<(draft: ActivityDraft) => void>();
    mount('mining', { personal: {}, last: {} }, onSubmit);
    setValue(field('place'), '矿洞 40 层');
    setValue(field('target'), '挖 30 铜矿');
    submit();
    expect(onSubmit.mock.calls[0]![0].details).toEqual({ place: '矿洞 40 层', target: '挖 30 铜矿' });
    expect(container.textContent).toContain('不估算产出');

    const fishing = vi.fn<(draft: ActivityDraft) => void>();
    act(() => root.unmount());
    root = createRoot(container);
    mount('fishing', { personal: {}, last: {} }, fishing);
    expect(field('place')).toBeTruthy();
    expect(field('target')).toBeTruthy();
  });

  it('活动可携带当次相关备注与清单', () => {
    const onSubmit = vi.fn<(draft: ActivityDraft) => void>();
    mount('shop', { personal: {}, last: {} }, onSubmit);
    setValue(field('note'), '赶在 17:00 前');
    setValue(field('checklist'), '防风草种子 ×10\n肥料 ×2');
    submit();
    expect(onSubmit.mock.calls[0]![0].note).toBe('赶在 17:00 前');
    expect(onSubmit.mock.calls[0]![0].checklist).toEqual(['防风草种子 ×10', '肥料 ×2']);
  });

  it('非出行类内置活动不出现起点/终点或地点/目标字段', () => {
    mount('water');
    expect(container.querySelector('[data-field="from"]')).toBeNull();
    expect(container.querySelector('[data-field="place"]')).toBeNull();
    expect(container.querySelector('[data-field="note"]')).not.toBeNull();
    expect(container.querySelector('[data-field="checklist"]')).not.toBeNull();
  });
});
