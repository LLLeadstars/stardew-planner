import { describe, expect, it } from 'vitest';
import {
  DAY_END,
  DAY_START,
  LAST_START,
  identityKey,
  resolveDropStart,
  swapAdjacentStarts,
} from '../../src/core';
import { makeActivity } from '../helpers';

describe('拖动落点：三个离散位置', () => {
  it('空闲区段起点：落到该空闲时段的起点', () => {
    const moved = makeActivity({ id: 'moved', start: 600, duration: 60 });
    const others = [makeActivity({ id: 'a', start: 480, duration: 60 })];
    expect(resolveDropStart(others, moved, { kind: 'gap', start: 900 })).toBe(900);
    expect(resolveDropStart(others, moved, { kind: 'gap', start: DAY_START })).toBe(DAY_START);
  });

  it('卡片上半：紧贴其前，结束时刻对齐目标开始时刻', () => {
    const moved = makeActivity({ id: 'moved', start: 600, duration: 60 });
    const target = makeActivity({ id: 'b', start: 900, duration: 30 });
    const start = resolveDropStart([target], moved, { kind: 'before', key: identityKey(target.identity) });
    expect(start).toBe(840); // 900 - 60
  });

  it('卡片下半：紧贴其后，开始时刻对齐目标结束时刻', () => {
    const moved = makeActivity({ id: 'moved', start: 600, duration: 60 });
    const target = makeActivity({ id: 'b', start: 900, duration: 30 });
    const start = resolveDropStart([target], moved, { kind: 'after', key: identityKey(target.identity) });
    expect(start).toBe(930); // 900 + 30
  });

  it('落点算出的开始时刻被夹在 06:00 至次日 01:50', () => {
    const moved = makeActivity({ id: 'moved', start: 600, duration: 120 });
    const early = makeActivity({ id: 'early', start: DAY_START + 30, duration: 30 });
    expect(resolveDropStart([early], moved, { kind: 'before', key: identityKey(early.identity) })).toBe(DAY_START);
    const late = makeActivity({ id: 'late', start: LAST_START, duration: 60 });
    expect(resolveDropStart([late], moved, { kind: 'after', key: identityKey(late.identity) })).toBe(LAST_START);
    expect(resolveDropStart([], moved, { kind: 'gap', start: DAY_END })).toBe(LAST_START);
  });

  it('不能把活动落在它自己身上，未知身份也不产生落点', () => {
    const moved = makeActivity({ id: 'moved', start: 600, duration: 60 });
    expect(resolveDropStart([moved], moved, { kind: 'before', key: identityKey(moved.identity) })).toBeNull();
    expect(resolveDropStart([moved], moved, { kind: 'after', key: 'manual:missing' })).toBeNull();
  });
});

describe('相邻交换开始时刻', () => {
  function plan() {
    return [
      makeActivity({ id: 'a', start: 360, duration: 60, name: '甲' }),
      makeActivity({ id: 'b', start: 600, duration: 90, name: '乙' }),
      makeActivity({ id: 'c', start: 900, duration: 30, name: '丙' }),
    ];
  }

  it('↓ 与下一项交换开始时刻', () => {
    const patches = swapAdjacentStarts(plan(), identityKey({ kind: 'manual', id: 'a' }), 'down');
    expect(patches).toEqual([
      { key: 'manual:a', start: 600 },
      { key: 'manual:b', start: 360 },
    ]);
  });

  it('↑ 与上一项交换开始时刻', () => {
    const patches = swapAdjacentStarts(plan(), identityKey({ kind: 'manual', id: 'c' }), 'up');
    expect(patches).toEqual([
      { key: 'manual:c', start: 600 },
      { key: 'manual:b', start: 900 },
    ]);
  });

  it('落在序列两端时不动', () => {
    const activities = plan();
    expect(swapAdjacentStarts(activities, identityKey({ kind: 'manual', id: 'a' }), 'up')).toEqual([]);
    expect(swapAdjacentStarts(activities, identityKey({ kind: 'manual', id: 'c' }), 'down')).toEqual([]);
    expect(swapAdjacentStarts(activities, 'manual:missing', 'up')).toEqual([]);
  });

  it('交换只改开始时刻，时长与内容不变', () => {
    const activities = plan();
    const before = activities.map((activity) => ({ ...activity, protection: { ...activity.protection } }));
    const patches = swapAdjacentStarts(activities, identityKey({ kind: 'manual', id: 'a' }), 'down');
    expect(patches.map((patch) => patch.start)).toEqual([600, 360]);
    // 原列表未被就地修改
    expect(activities).toEqual(before);
    expect(activities.find((a) => identityKey(a.identity) === 'manual:b')?.duration).toBe(90);
    expect(activities.find((a) => identityKey(a.identity) === 'manual:b')?.name).toBe('乙');
  });

  it('按开始时刻排序后再找相邻项，而不是按数组顺序', () => {
    const shuffled = [
      makeActivity({ id: 'c', start: 900, duration: 30 }),
      makeActivity({ id: 'a', start: 360, duration: 60 }),
      makeActivity({ id: 'b', start: 600, duration: 90 }),
    ];
    expect(swapAdjacentStarts(shuffled, 'manual:a', 'down')).toEqual([
      { key: 'manual:a', start: 600 },
      { key: 'manual:b', start: 360 },
    ]);
  });
});
