import { describe, expect, it } from 'vitest';
import { judgeShop, weekdayOf } from '../../src/core';
import type { GameDate, PlayerStates } from '../../src/core';

/** 春 1 日＝周一，季节固定 28 天，因此星期只由「季 + 日」决定。 */
const monday: GameDate = { year: 1, season: 0, day: 1 };
const tuesday: GameDate = { year: 1, season: 0, day: 2 };
const wednesday: GameDate = { year: 1, season: 0, day: 3 };
const friday: GameDate = { year: 1, season: 0, day: 5 };
const summer18: GameDate = { year: 1, season: 1, day: 18 };
const winter16: GameDate = { year: 1, season: 3, day: 16 };

describe('游戏日星期', () => {
  it('春 1 日为周一，季节内按日历推进', () => {
    expect(weekdayOf(monday)).toBe('mon');
    expect(weekdayOf(tuesday)).toBe('tue');
    expect(weekdayOf(wednesday)).toBe('wed');
    expect(weekdayOf(friday)).toBe('fri');
    expect(weekdayOf({ year: 2, season: 0, day: 1 })).toBe('mon');
    expect(weekdayOf({ year: 1, season: 1, day: 1 })).toBe('mon');
  });
});

describe('皮埃尔杂货店：周三受社区中心与城镇钥匙影响', () => {
  it('社区中心与城镇钥匙都未知时，建筑与服务都保持未知', () => {
    const judgement = judgeShop('pierre', wednesday, {});
    expect(judgement.access.state).toBe('unknown');
    expect(judgement.access.tone).toBe('unknown');
    expect(judgement.access.label).toBe('暂按不可用');
    expect(judgement.service.state).toBe('unknown');
    expect(judgement.service.tone).toBe('unknown');
    expect(judgement.service.label).toBe('暂按不可用');
  });

  it('社区中心已修复后周三照常开放', () => {
    const judgement = judgeShop('pierre', wednesday, { communityCenter: 'restored' });
    expect(judgement.access).toMatchObject({ state: 'available', hours: '09:00–21:00' });
    expect(judgement.service).toMatchObject({ state: 'available', hours: '09:00–17:00' });
  });

  it('持有城镇钥匙也让周三是可交易', () => {
    const judgement = judgeShop('pierre', wednesday, {
      communityCenter: 'notRestored',
      townKey: 'yes',
    });
    expect(judgement.access.state).toBe('available');
    expect(judgement.service.state).toBe('available');
  });

  it('社区中心未修复且无钥匙时周三确认关闭', () => {
    const judgement = judgeShop('pierre', wednesday, {
      communityCenter: 'notRestored',
      townKey: 'no',
    });
    expect(judgement.access).toMatchObject({ state: 'unavailable', label: '确认关闭' });
    expect(judgement.service).toMatchObject({ state: 'unavailable', label: '确认关闭' });
    expect(judgement.service.reason).toContain('周三');
  });

  it('普通工作日建筑开放到晚、服务营业到 17:00', () => {
    const judgement = judgeShop('pierre', monday, {});
    expect(judgement.access).toMatchObject({ state: 'available', hours: '09:00–21:00' });
    expect(judgement.service).toMatchObject({ state: 'available', hours: '09:00–17:00' });
  });

  it('节日通常关闭', () => {
    const judgement = judgeShop('pierre', monday, { specialDay: 'festival' });
    expect(judgement.access.state).toBe('unavailable');
    expect(judgement.service.state).toBe('unavailable');
  });

  it('规则详情披露版本、来源、核验日期、可信度与待验证项', () => {
    const [rule] = judgeShop('pierre', monday, {}).rules;
    expect(rule?.version).toBe('PC 原版 1.6.15');
    expect(rule?.platform).toBe('PC');
    expect(rule?.source.length).toBeGreaterThan(0);
    expect(rule?.verifiedAt).toBe('2026-09-18');
    expect(rule?.confidence.length).toBeGreaterThan(0);
    expect(rule?.pending.length).toBeGreaterThan(0);
    expect(rule?.conditions.length).toBeGreaterThan(0);
  });
});

describe('木匠商店：建筑可进入与服务可交易分开', () => {
  it('普通周二服务确认关闭，但仍给出黄色柜台技巧，且不把整段标成营业', () => {
    const judgement = judgeShop('carpenter', tuesday, { weather: 'sunny' });
    expect(judgement.service.state).toBe('unavailable');
    expect(judgement.service.tone).toBe('closed');
    expect(judgement.service.label).toBe('确认关闭');
    expect(judgement.service.reason).toContain('今日休息');
    expect(judgement.service.hours).toBeUndefined();
    const tip = judgement.tips.find((entry) => entry.approximateTime === 9 * 60 + 40);
    expect(tip?.text).toContain('9:40');
    expect(judgement.access).toMatchObject({ state: 'available', hours: '09:00–20:00' });
  });

  it('雨天的周二按正常时段营业，不再显示周二技巧', () => {
    const judgement = judgeShop('carpenter', tuesday, { weather: 'rain' });
    expect(judgement.service).toMatchObject({ state: 'available', hours: '09:00–17:00' });
    expect(judgement.tips).toEqual([]);
  });

  it('天气未知时服务保持未知，但技巧仍作为非阻断提示保留', () => {
    const judgement = judgeShop('carpenter', tuesday, {});
    expect(judgement.service.state).toBe('unknown');
    expect(judgement.tips.some((entry) => entry.approximateTime === 9 * 60 + 40)).toBe(true);
  });

  it('罗宾在农场施工时全天关闭，并隐藏柜台技巧', () => {
    const judgement = judgeShop('carpenter', tuesday, { robinWorking: 'yes' });
    expect(judgement.service.state).toBe('unavailable');
    expect(judgement.service.reason).toContain('施工');
    expect(judgement.tips).toEqual([]);
  });

  it('夏 18 日因诊所行程关闭，但保留约 17:50 的技巧', () => {
    const judgement = judgeShop('carpenter', summer18, { weather: 'sunny' });
    expect(judgement.service.state).toBe('unavailable');
    expect(judgement.tips.some((entry) => entry.approximateTime === 17 * 60 + 50)).toBe(true);
  });

  it('周五服务提前到 16:00 结束', () => {
    const judgement = judgeShop('carpenter', friday, { weather: 'sunny' });
    expect(judgement.service).toMatchObject({ state: 'available', hours: '09:00–16:00' });
  });

  it('条件性窗口携带独立规则来源与可信度', () => {
    const judgement = judgeShop('carpenter', tuesday, { weather: 'sunny' });
    const tipRule = judgement.rules.find((rule) => rule.ruleId.includes('tuesday'));
    expect(tipRule).toBeTruthy();
    expect(tipRule?.pending.length).toBeGreaterThan(0);
  });
});

describe('铁匠铺：条件化服务与未知降级', () => {
  it('普通工作日建筑与柜台都为 09:00–16:00', () => {
    const judgement = judgeShop('blacksmith', monday, { communityCenter: 'notRestored' });
    expect(judgement.access).toMatchObject({ state: 'available', hours: '09:00–16:00' });
    expect(judgement.service).toMatchObject({ state: 'available', hours: '09:00–16:00' });
  });

  it('社区中心修复后的晴天周五 Clint 不在店', () => {
    const judgement = judgeShop('blacksmith', friday, {
      communityCenter: 'restored',
      weather: 'sunny',
    });
    expect(judgement.service.state).toBe('unavailable');
    expect(judgement.service.reason).toContain('周五');
  });

  it('周五下雨是例外，服务照常', () => {
    const judgement = judgeShop('blacksmith', friday, {
      communityCenter: 'restored',
      weather: 'rain',
    });
    expect(judgement.service.state).toBe('available');
  });

  it('周五绿雨可能覆盖惯例，服务保持未知', () => {
    const judgement = judgeShop('blacksmith', { year: 2, season: 0, day: 5 }, {
      communityCenter: 'restored',
      weather: 'greenRain',
    });
    expect(judgement.service.state).toBe('unknown');
  });

  it('社区中心状态未知时周五服务保持未知', () => {
    const judgement = judgeShop('blacksmith', friday, { weather: 'sunny' });
    expect(judgement.service.state).toBe('unknown');
  });

  it('冬 16 日 10:30 后离店，只保留上午窗口', () => {
    const judgement = judgeShop('blacksmith', winter16, {
      communityCenter: 'notRestored',
      weather: 'sunny',
    });
    expect(judgement.service).toMatchObject({ state: 'available', hours: '09:00–10:30' });
  });

  it('第 1 年绿雨日 Clint 离店', () => {
    const judgement = judgeShop('blacksmith', monday, {
      communityCenter: 'notRestored',
      weather: 'greenRain',
    });
    expect(judgement.service.state).toBe('unavailable');
  });

  it('节日通常关闭', () => {
    const judgement = judgeShop('blacksmith', monday, {
      communityCenter: 'notRestored',
      specialDay: 'festival',
    });
    expect(judgement.service.state).toBe('unavailable');
  });
});

describe('门店判定的纯函数行为', () => {
  it('相同输入返回相同结论，不依赖调用顺序', () => {
    const states: PlayerStates = { weather: 'sunny', communityCenter: 'notRestored' };
    expect(judgeShop('carpenter', tuesday, states)).toEqual(judgeShop('carpenter', tuesday, states));
  });
});
