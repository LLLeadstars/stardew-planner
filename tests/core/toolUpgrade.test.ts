import { describe, expect, it } from 'vitest';
import {
  addDays,
  canDeliverTool,
  canPickupTool,
  createPendingToolUpgrade,
  earliestPickupDate,
  isBlacksmithCounterOpen,
  nextToolLevel,
  toolUpgradeOffer,
  toolUpgradePhase,
} from '../../src/core';
import type { GameDate, PendingToolUpgrade, PlayerStates } from '../../src/core';

/** 春 1 日＝周一；春 3 日＝周三；春 5 日＝周五；春 6 日＝周六。 */
const spring1: GameDate = { year: 1, season: 0, day: 1 };
const spring3: GameDate = { year: 1, season: 0, day: 3 };
const spring5: GameDate = { year: 1, season: 0, day: 5 };

function key(date: GameDate): string {
  return `${date.year}-${date.season}-${date.day}`;
}

function pending(overrides: Partial<PendingToolUpgrade> = {}): PendingToolUpgrade {
  const base = createPendingToolUpgrade('axe', 'copper', spring3)!;
  return { ...base, ...overrides };
}

describe('工具升级链', () => {
  it('斧头等从基础逐级升到铱，不能跳级', () => {
    expect(nextToolLevel('axe', 'basic')).toBe('copper');
    expect(nextToolLevel('axe', 'copper')).toBe('steel');
    expect(nextToolLevel('axe', 'gold')).toBe('iridium');
    expect(nextToolLevel('axe', 'iridium')).toBeNull();
  });

  it('淘盘从铜级起，没有「基础 → 铜」这一跳', () => {
    expect(nextToolLevel('pan', 'basic')).toBeNull();
    expect(nextToolLevel('pan', 'copper')).toBe('steel');
  });

  it('材料与费用按目标等级给出，垃圾桶费用减半', () => {
    expect(toolUpgradeOffer('axe', 'basic')).toEqual({
      tool: 'axe',
      fromLevel: 'basic',
      targetLevel: 'copper',
      materials: [{ name: '铜锭', count: 5 }],
      cost: 2000,
    });
    expect(toolUpgradeOffer('axe', 'copper')).toMatchObject({
      targetLevel: 'steel',
      materials: [{ name: '铁锭', count: 5 }],
      cost: 5000,
    });
    expect(toolUpgradeOffer('trash', 'basic')).toMatchObject({ targetLevel: 'copper', cost: 1000 });
    expect(toolUpgradeOffer('trash', 'gold')).toMatchObject({
      targetLevel: 'iridium',
      materials: [{ name: '铱锭', count: 5 }],
      cost: 12500,
    });
    expect(toolUpgradeOffer('pan', 'copper')).toMatchObject({ targetLevel: 'steel', cost: 5000 });
    expect(toolUpgradeOffer('axe', 'iridium')).toBeNull();
  });
});

describe('工具升级状态机：交付、完成日与取回', () => {
  it('计划交付不改状态；完成交付后才创建升级中记录', () => {
    const created = createPendingToolUpgrade('axe', 'copper', spring3);
    expect(created).toEqual({
      tool: 'axe',
      fromLevel: 'copper',
      targetLevel: 'steel',
      deliveredOn: spring3,
      completesOn: spring5,
    });
  });

  it('完成日固定为交付日 D+2，不因柜台关闭顺延；跨季与跨年按日历进位', () => {
    const crossSeason = createPendingToolUpgrade(
      'axe',
      'basic',
      { year: 1, season: 0, day: 28 },
    );
    expect(crossSeason?.completesOn).toEqual({ year: 1, season: 1, day: 2 });

    const crossYear = createPendingToolUpgrade('axe', 'basic', { year: 1, season: 3, day: 28 });
    expect(crossYear?.completesOn).toEqual({ year: 2, season: 0, day: 2 });
  });

  it('D+2 前为升级中，到达 D+2 当天及之后为待取回', () => {
    const upgrade = pending();
    expect(toolUpgradePhase(upgrade, { year: 1, season: 0, day: 4 })).toBe('upgrading');
    expect(toolUpgradePhase(upgrade, spring5)).toBe('ready');
    expect(toolUpgradePhase(upgrade, addDays(spring5, 1))).toBe('ready');
  });

  it('D+2 恰逢柜台关闭时，完成日不顺延、最早可取回日顺延到首个可交易日', () => {
    // 春 3 日（周三）交付，D+2 是春 5 日（周五）；社区中心修复后周五 Clint 不在店。
    const states: PlayerStates = { communityCenter: 'restored' };
    const upgrade = pending();
    expect(upgrade.completesOn).toEqual(spring5);
    expect(key(earliestPickupDate(upgrade.completesOn, states))).toBe('1-0-6');
  });

  it('普通日期下最早可取回日就是完成日', () => {
    const completesOn: GameDate = { year: 1, season: 0, day: 4 };
    expect(key(earliestPickupDate(completesOn, { communityCenter: 'notRestored' }))).toBe('1-0-4');
  });

  it('投影未来日期时不把「今天」的天气与特殊日外推', () => {
    const states: PlayerStates = {
      communityCenter: 'notRestored',
      weather: 'greenRain',
      specialDay: 'festival',
    };
    // 周一（春 1 日）不受今天绿雨/节日影响，仍是可交易日。
    expect(key(earliestPickupDate(spring1, states))).toBe('1-0-1');
  });

  it('冬 16 日上午仍可交易，因此算作可交易日', () => {
    const winter16: GameDate = { year: 1, season: 3, day: 16 };
    expect(isBlacksmithCounterOpen(winter16, { communityCenter: 'notRestored' })).toBe(true);
    expect(key(earliestPickupDate(winter16, { communityCenter: 'notRestored' }))).toBe('1-3-16');
  });
});

describe('工具升级的准入检查', () => {
  it('没有升级中工具时，已知当前等级即可交付', () => {
    expect(canDeliverTool(null, 'axe', 'basic').ok).toBe(true);
  });

  it('当前等级未填写或已是最高等级时拒绝交付，并说明原因', () => {
    const missing = canDeliverTool(null, 'axe', undefined);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.reason).toContain('当前等级');

    const maxed = canDeliverTool(null, 'axe', 'iridium');
    expect(maxed.ok).toBe(false);
    if (maxed.ok) return;
    expect(maxed.reason).toContain('最高等级');
  });

  it('上一件完成取回前再次发起交付被拒绝，并说明原因', () => {
    const check = canDeliverTool(pending({ tool: 'axe' }), 'pickaxe', 'basic');
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.reason).toContain('斧头');
    expect(check.reason).toContain('只能升级一件工具');
  });

  it('未到完成日不能取回', () => {
    const check = canPickupTool(pending(), 'axe', { year: 1, season: 0, day: 4 }, {});
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.reason).toContain('暂不能取回');
  });

  it('工具不匹配或没有升级中工具时不能取回', () => {
    expect(canPickupTool(null, 'axe', spring5, {}).ok).toBe(false);
    const mismatch = canPickupTool(pending({ tool: 'axe' }), 'pickaxe', spring5, {
      communityCenter: 'notRestored',
    });
    expect(mismatch.ok).toBe(false);
    if (mismatch.ok) return;
    expect(mismatch.reason).toContain('斧头');
  });

  it('到完成日且柜台可交易时可以取回', () => {
    expect(canPickupTool(pending(), 'axe', spring5, { communityCenter: 'notRestored' }).ok).toBe(true);
  });

  it('到完成日但柜台不可交易时不能取回', () => {
    const check = canPickupTool(pending(), 'axe', spring5, { communityCenter: 'restored' });
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.reason).toContain('柜台');
  });
});
