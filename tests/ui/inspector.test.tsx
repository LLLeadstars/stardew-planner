// @vitest-environment jsdom
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Activity,
  ActivityPatch,
  ActivityType,
  GameDate,
  PendingToolUpgrade,
  PlayerStateCommand,
  PlayerStates,
} from '../../src/core';
import { createPendingToolUpgrade } from '../../src/core';
import { Inspector } from '../../src/ui/Inspector';
import { makeActivity } from '../helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const WEDNESDAY: GameDate = { year: 1, season: 0, day: 3 };

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

function renderInspector(
  activity: Activity | null,
  overrides: {
    preferences?: { personal: Record<string, number>; last: Record<string, number> };
    playerStates?: PlayerStates;
    currentDay?: GameDate;
    onPatch?: (patch: ActivityPatch) => void;
    onSaveDefault?: (activityType: ActivityType, minutes: number) => void;
    onSetState?: (command: PlayerStateCommand) => void;
    toolUpgrade?: PendingToolUpgrade | null;
  } = {},
) {
  mount(
    <Inspector
      activity={activity}
      currentDay={overrides.currentDay ?? WEDNESDAY}
      playerStates={overrides.playerStates ?? {}}
      preferences={overrides.preferences ?? { personal: {}, last: {} }}
      toolUpgrade={overrides.toolUpgrade ?? null}
      onPatch={overrides.onPatch ?? (() => {})}
      onSaveDefault={overrides.onSaveDefault ?? (() => {})}
      onDelete={() => {}}
      onSetState={overrides.onSetState ?? (() => {})}
    />,
  );
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

function choose(element: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function button(action: string): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
}

describe('检查器：时长来源与个人默认', () => {
  it('展示解析链上的个人默认、最近一次预留与系统推荐预留', () => {
    renderInspector(makeActivity({ id: 'a', start: 360, duration: 80 }), {
      preferences: { personal: { custom: 90 }, last: { custom: 40 } },
    });
    const hint = container.textContent ?? '';
    expect(hint).toContain('1 小时 30 分钟'); // 个人默认 90
    expect(hint).toContain('40 分钟'); // 最近一次预留
    expect(hint).toContain('30 分钟'); // 系统推荐预留
  });

  it('点击「保存为个人默认」把当前时长与活动类型交给应用层', () => {
    const onSaveDefault = vi.fn<(activityType: ActivityType, minutes: number) => void>();
    renderInspector(makeActivity({ id: 'a', start: 360, duration: 80 }), { onSaveDefault });
    const target = Array.from(container.querySelectorAll('button')).find((element) =>
      element.textContent?.includes('保存为个人默认'),
    );
    act(() => {
      target?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSaveDefault).toHaveBeenCalledWith('custom', 80);
  });
});

describe('检查器：当次相关字段', () => {
  it('编辑备注与清单后交给应用层', () => {
    const onPatch = vi.fn<(patch: ActivityPatch) => void>();
    renderInspector(
      makeActivity({ id: 'a', start: 360, duration: 60, note: '旧备注', checklist: ['甲'] }),
      { onPatch },
    );
    setValue(field('note'), '新备注');
    expect(onPatch).toHaveBeenCalledWith({ note: '新备注' });

    onPatch.mockClear();
    setValue(field('checklist'), '甲\n乙\n丙');
    expect(onPatch).toHaveBeenCalledWith({ checklist: ['甲', '乙', '丙'] });
  });

  it('赶路显示起点与终点，编辑其一保留另一个', () => {
    const onPatch = vi.fn<(patch: ActivityPatch) => void>();
    renderInspector(
      makeActivity({
        id: 'a',
        start: 360,
        duration: 60,
        activityType: 'travel',
        details: { from: '农场', to: '镇上' },
      }),
      { onPatch },
    );
    setValue(field('from'), '矿区');
    expect(onPatch).toHaveBeenCalledWith({ details: { from: '矿区', to: '镇上' } });
  });

  it('钓鱼显示地点与自由文本目标，编辑目标保留地点', () => {
    const onPatch = vi.fn<(patch: ActivityPatch) => void>();
    renderInspector(
      makeActivity({
        id: 'a',
        start: 360,
        duration: 120,
        activityType: 'fishing',
        details: { place: '山湖' },
      }),
      { onPatch },
    );
    setValue(field('target'), '钓 5 条鲈鱼');
    expect(onPatch).toHaveBeenCalledWith({ details: { place: '山湖', target: '钓 5 条鲈鱼' } });
  });

  it('非赶路/钓鱼/采矿活动不出现这些字段', () => {
    renderInspector(makeActivity({ id: 'a', start: 360, duration: 60, activityType: 'water' }));
    expect(container.querySelector('[data-field="from"]')).toBeNull();
    expect(container.querySelector('[data-field="place"]')).toBeNull();
    expect(container.querySelector('[data-field="note"]')).not.toBeNull();
  });
});

describe('检查器：购物活动的门店判定', () => {
  function shopActivity(details: Activity['details'] = { shop: 'pierre' }) {
    return makeActivity({ id: 'shop', start: 540, duration: 60, activityType: 'shop', details });
  }

  it('未知社区中心状态的周三，两个结论分开显示且都为黄色暂按不可用', () => {
    renderInspector(shopActivity());
    expect(container.textContent).toContain('建筑可进入：暂按不可用');
    expect(container.textContent).toContain('服务可交易：暂按不可用');
    expect(container.querySelector('[data-testid="shop-access"]')?.className).toContain('unknown');
    expect(container.querySelector('[data-testid="shop-service"]')?.className).toContain('unknown');
  });

  it('可就地补充社区中心状态后复核', () => {
    const onSetState = vi.fn<(command: PlayerStateCommand) => void>();
    renderInspector(shopActivity(), { onSetState });
    choose(container.querySelector<HTMLSelectElement>('[data-field="state-communityCenter"]')!, 'restored');
    expect(onSetState).toHaveBeenCalledWith({ kind: 'setCommunityCenter', value: 'restored' });
  });

  it('已补充状态后结论变为绿色确认可交易', () => {
    renderInspector(shopActivity(), {
      playerStates: { communityCenter: 'restored' },
    });
    expect(container.textContent).toContain('服务可交易：确认可交易');
    expect(container.querySelector('[data-testid="shop-service"]')?.className).toContain('ok');
  });

  it('未选择门店时不给出结论', () => {
    renderInspector(shopActivity({}));
    expect(container.querySelector('[data-testid="shop-availability"]')).toBeNull();
    expect(container.textContent).toContain('选择门店后');
  });

  it('展开规则详情可看到版本、判断条件、来源、核验日期、可信度与待验证项', () => {
    renderInspector(shopActivity());
    const details = container.querySelector('[data-testid="shop-rule-details"]');
    expect(details).not.toBeNull();
    const text = details?.textContent ?? '';
    expect(text).toContain('PC 原版 1.6.15');
    expect(text).toContain('判断条件');
    expect(text).toContain('来源');
    expect(text).toContain('核验日期');
    expect(text).toContain('2026-09-18');
    expect(text).toContain('可信度');
    expect(text).toContain('待验证');
  });

  it('购物清单项可自由增删，并明确不校验价格、库存或购买条件', () => {
    const onPatch = vi.fn<(patch: ActivityPatch) => void>();
    renderInspector(
      shopActivity({
        shop: 'pierre',
        shoppingList: [{ name: '防风草种子', quantity: '10' }],
      }),
      { onPatch },
    );
    expect(container.textContent).toContain('工具不校验价格、库存或购买条件');

    act(() => {
      button('add-shop-item').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onPatch).toHaveBeenLastCalledWith({
      details: {
        shop: 'pierre',
        shoppingList: [
          { name: '防风草种子', quantity: '10' },
          { name: '', quantity: '' },
        ],
      },
    });

    onPatch.mockClear();
    act(() => {
      button('remove-shop-item').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onPatch).toHaveBeenLastCalledWith({
      details: { shop: 'pierre', shoppingList: [] },
    });
  });

  it('编辑购物清单项名称与数量只改这一项', () => {
    const onPatch = vi.fn<(patch: ActivityPatch) => void>();
    renderInspector(
      shopActivity({ shop: 'pierre', shoppingList: [{ name: '甲', quantity: '1' }] }),
      { onPatch },
    );
    setValue(field('shop-item-quantity'), '3');
    expect(onPatch).toHaveBeenLastCalledWith({
      details: { shop: 'pierre', shoppingList: [{ name: '甲', quantity: '3' }] },
    });
  });

  it('购物活动不显示通用文本清单', () => {
    renderInspector(shopActivity());
    expect(container.querySelector('[data-field="checklist"]')).toBeNull();
  });
});

describe('检查器：工具升级交付与取回', () => {
  function giveActivity(details: Activity['details'] = {}) {
    return makeActivity({ id: 'give', start: 600, duration: 60, activityType: 'toolGive', details });
  }

  function takeActivity(details: Activity['details'] = {}) {
    return makeActivity({ id: 'take', start: 600, duration: 60, activityType: 'toolTake', details });
  }

  it('交付活动显示目标等级、材料与费用', () => {
    renderInspector(giveActivity({ tool: 'axe' }), {
      playerStates: { toolLevels: { axe: 'copper' } },
    });
    const offer = container.querySelector('[data-testid="tool-upgrade-offer"]');
    expect(offer?.textContent).toContain('目标等级：钢');
    expect(offer?.textContent).toContain('铁锭 ×5');
    expect(offer?.textContent).toContain('费用');
  });

  it('垃圾桶费用减半', () => {
    renderInspector(giveActivity({ tool: 'trash' }), {
      playerStates: { toolLevels: { trash: 'basic' } },
    });
    expect(container.querySelector('[data-testid="tool-upgrade-offer"]')?.textContent).toContain(
      '1,000g',
    );
  });

  it('选择工具与就地填写当前等级都会写回应用层', () => {
    const onPatch = vi.fn<(patch: ActivityPatch) => void>();
    const onSetState = vi.fn<(command: PlayerStateCommand) => void>();
    renderInspector(giveActivity(), { onPatch, onSetState });
    choose(container.querySelector<HTMLSelectElement>('[data-field="tool"]')!, 'axe');
    expect(onPatch).toHaveBeenCalledWith({ details: { tool: 'axe' } });

    renderInspector(giveActivity({ tool: 'axe' }), { onSetState });
    choose(container.querySelector<HTMLSelectElement>('[data-field="state-tool-level"]')!, 'steel');
    expect(onSetState).toHaveBeenCalledWith({ kind: 'setToolLevel', tool: 'axe', level: 'steel' });
  });

  it('取回活动显示完成日、最早可取回日期与背包空位提醒', () => {
    const upgrade = createPendingToolUpgrade('axe', 'copper', WEDNESDAY)!;
    renderInspector(takeActivity({ tool: 'axe' }), {
      toolUpgrade: upgrade,
      playerStates: { communityCenter: 'restored' },
    });
    const status = container.querySelector('[data-testid="tool-upgrade-status"]');
    expect(status?.textContent).toContain('完成日');
    expect(status?.textContent).toContain('最早可取回');
    expect(status?.textContent).toContain('第 1 年 春 6 日'); // D+2 周五关闭，顺延到周六
    expect(container.querySelector('[data-testid="tool-bag-reminder"]')?.textContent).toContain(
      '背包空位',
    );
  });

  it('上一件完成取回前再次交付：完成勾选被禁用并说明原因', () => {
    const upgrade = createPendingToolUpgrade('pickaxe', 'basic', WEDNESDAY)!;
    renderInspector(giveActivity({ tool: 'axe' }), {
      toolUpgrade: upgrade,
      playerStates: { toolLevels: { axe: 'copper' } },
    });
    const checkbox = container.querySelector<HTMLInputElement>('.check-row input')!;
    expect(checkbox.disabled).toBe(true);
    expect(container.querySelector('[data-testid="tool-block-reason"]')?.textContent).toContain(
      '只能升级一件工具',
    );
  });
});

describe('检查器：交付后的完成日与最早可取回日期', () => {
  it('交付活动给出 D+2 完成日与最早可取回日期', () => {
    const upgrade = createPendingToolUpgrade('axe', 'copper', WEDNESDAY)!;
    renderInspector(
      makeActivity({
        id: 'give',
        start: 600,
        duration: 60,
        activityType: 'toolGive',
        details: { tool: 'axe' },
      }),
      {
        toolUpgrade: upgrade,
        playerStates: { toolLevels: { axe: 'steel' }, communityCenter: 'restored' },
      },
    );
    const text = container.querySelector('[data-testid="tool-in-progress"]')?.textContent ?? '';
    expect(text).toContain('完成日');
    expect(text).toContain('最早可取回');
    expect(text).toContain('第 1 年 春 6 日');
  });
});
