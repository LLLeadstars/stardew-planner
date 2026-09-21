import { describe, expect, it } from 'vitest';
import {
  DAY_END,
  DAY_START,
  LAST_START,
  clampDuration,
  clampStart,
  endOf,
  formatDuration,
  formatTime,
  overrunMinutes,
  snapToStep,
} from '../../src/core';

describe('游戏内时间', () => {
  it('游戏日从 06:00 到次日 02:00', () => {
    expect(DAY_START).toBe(360);
    expect(DAY_END).toBe(1560);
    expect(LAST_START).toBe(1550);
  });

  it('10 游戏分钟最小粒度', () => {
    expect(snapToStep(33)).toBe(30);
    expect(snapToStep(35)).toBe(40);
  });

  it('午夜后的时刻显示为「次日 00:30」而不是「24:30」', () => {
    expect(formatTime(1470)).toBe('次日 00:30');
    expect(formatTime(1440)).toBe('次日 00:00');
    expect(formatTime(360)).toBe('06:00');
    expect(formatTime(1530)).toBe('次日 01:30');
    expect(formatTime(1560)).toBe('次日 02:00');
  });

  it('次日 02:00 不能作为开始时刻', () => {
    expect(clampStart(DAY_END)).toBe(LAST_START);
    expect(clampStart(9999)).toBe(LAST_START);
    expect(clampStart(1550)).toBe(1550);
  });

  it('开始时刻不早于 06:00', () => {
    expect(clampStart(0)).toBe(DAY_START);
    expect(clampStart(350)).toBe(DAY_START);
  });

  it('时长遵守 10 分钟粒度且至少 10 分钟', () => {
    expect(clampDuration(33)).toBe(30);
    expect(clampDuration(5)).toBe(10);
    expect(clampDuration(0)).toBe(10);
  });

  it('结束时刻由开始时刻与时长计算，超出次日 02:00 时给出超出分钟数', () => {
    expect(endOf(1500, 60)).toBe(1560);
    expect(overrunMinutes(1560)).toBe(0);
    expect(overrunMinutes(1590)).toBe(30);
  });

  it('时长文案可读', () => {
    expect(formatDuration(90)).toBe('1 小时 30 分钟');
    expect(formatDuration(120)).toBe('2 小时');
    expect(formatDuration(30)).toBe('30 分钟');
  });
});
