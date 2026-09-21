// @vitest-environment jsdom
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityType } from '../../src/core';
import { AddActivityDialog } from '../../src/ui/AddActivityDialog';
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

describe('添加弹层：时长预填来自解析链', () => {
  it('未改动时长时让 reducer 走解析链', () => {
    const onSubmit = vi.fn<(name: string, duration?: number) => void>();
    mount(
      <AddActivityDialog
        activityType="custom"
        preferences={{ personal: { custom: 90 }, last: {} }}
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    );
    expect(container.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe('90');
    const form = container.querySelector('form')!;
    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledWith('自定义活动', undefined);
  });

  it('改动过时长时作为当前活动手填值提交', () => {
    const onSubmit = vi.fn<(name: string, duration?: number) => void>();
    mount(
      <AddActivityDialog
        activityType="custom"
        preferences={{ personal: { custom: 90 }, last: {} }}
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setValue?.call(input, '40');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledWith('自定义活动', 40);
  });
});
