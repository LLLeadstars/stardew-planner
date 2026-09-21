import { describe, expect, it } from 'vitest';
import { DAY_END, DAY_START, activityRange, freeGaps, overruns, sortedActivities } from '../../src/core';
import { makeActivity } from '../helpers';

describe('空闲时段', () => {
  it('没有任何活动时整段游戏日都是空闲', () => {
    expect(freeGaps([])).toEqual([{ start: DAY_START, end: DAY_END, minutes: 1200 }]);
  });

  it('只有完全没有活动占用的连续区间才算空闲', () => {
    const activities = [
      makeActivity({ id: 'tv', start: 370, duration: 10 }), // 06:10–06:20
      makeActivity({ id: 'water', start: 480, duration: 60 }), // 08:00–09:00
      makeActivity({ id: 'shop', start: 520, duration: 40 }), // 08:40–09:20
      makeActivity({ id: 'mine', start: 1530, duration: 60 }), // 次日 01:30–02:30
    ];
    expect(freeGaps(activities)).toEqual([
      { start: 360, end: 370, minutes: 10 }, // 06:00–06:10
      { start: 380, end: 480, minutes: 100 }, // 06:20–08:00
      { start: 560, end: 1530, minutes: 970 }, // 09:20–次日 01:30
    ]);
  });

  it('最后一项活动之后到游戏日结束的空闲同样计入', () => {
    const activities = [makeActivity({ id: 'a', start: 360, duration: 60 })];
    expect(freeGaps(activities)).toEqual([{ start: 420, end: DAY_END, minutes: 1140 }]);
  });
});

describe('超出游戏日', () => {
  it('结束时刻晚于次日 02:00 时提示超出分钟数', () => {
    const activities = [
      makeActivity({ id: 'mine', start: 1530, duration: 60 }),
      makeActivity({ id: 'ok', start: 360, duration: 60 }),
    ];
    const result = overruns(activities);
    expect(result).toHaveLength(1);
    expect(result[0]?.minutes).toBe(30);
    expect(result[0]?.activity.start).toBe(1530);
    expect(result[0]?.activity.duration).toBe(60);
  });

  it('恰好结束于次日 02:00 不算超出', () => {
    expect(overruns([makeActivity({ start: 1500, duration: 60 })])).toEqual([]);
  });
});

describe('活动排序与时区', () => {
  it('列表按开始时刻排列，同刻按身份稳定排序', () => {
    const late = makeActivity({ id: 'late', start: 600, duration: 30 });
    const earlyA = makeActivity({ id: 'b', start: 400, duration: 30 });
    const earlyB = makeActivity({ id: 'a', start: 400, duration: 30 });
    expect(sortedActivities([late, earlyA, earlyB]).map((a) => a.identity.kind === 'manual' && a.identity.id)).toEqual([
      'a',
      'b',
      'late',
    ]);
  });

  it('结束时刻由开始时刻与时长计算', () => {
    expect(activityRange(makeActivity({ start: 1500, duration: 90 }))).toEqual({ start: 1500, end: 1590 });
  });
});
