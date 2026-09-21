import { describe, expect, it } from 'vitest';
import {
  emptyReservePreferences,
  resolveReserve,
  systemReserve,
  withLastReserve,
  withPersonalReserve,
} from '../../src/core';

describe('时长来源解析（按时间预留）', () => {
  it('没有任何偏好时落到系统推荐预留', () => {
    const preferences = emptyReservePreferences();
    expect(resolveReserve({ activityType: 'custom', preferences })).toEqual({
      minutes: systemReserve('custom'),
      source: 'system',
    });
  });

  it('最近一次预留覆盖系统推荐预留', () => {
    const preferences = withLastReserve(emptyReservePreferences(), 'custom', 40);
    expect(resolveReserve({ activityType: 'custom', preferences })).toEqual({
      minutes: 40,
      source: 'last',
    });
  });

  it('个人默认覆盖最近一次预留', () => {
    let preferences = withLastReserve(emptyReservePreferences(), 'custom', 40);
    preferences = withPersonalReserve(preferences, 'custom', 90);
    expect(resolveReserve({ activityType: 'custom', preferences })).toEqual({
      minutes: 90,
      source: 'personal',
    });
  });

  it('当前手填值覆盖个人默认', () => {
    let preferences = withLastReserve(emptyReservePreferences(), 'custom', 40);
    preferences = withPersonalReserve(preferences, 'custom', 90);
    expect(resolveReserve({ activityType: 'custom', preferences, handwritten: 20 })).toEqual({
      minutes: 20,
      source: 'manual',
    });
  });

  it('手填值为 0 或无效时不参与解析', () => {
    const preferences = withPersonalReserve(emptyReservePreferences(), 'custom', 90);
    expect(resolveReserve({ activityType: 'custom', preferences, handwritten: Number.NaN })).toEqual({
      minutes: 90,
      source: 'personal',
    });
    expect(resolveReserve({ activityType: 'custom', preferences, handwritten: 0 })).toEqual({
      minutes: 90,
      source: 'personal',
    });
  });

  it('解析出的时长遵守 10 分钟粒度', () => {
    const preferences = withPersonalReserve(emptyReservePreferences(), 'custom', 33);
    expect(resolveReserve({ activityType: 'custom', preferences })).toEqual({
      minutes: 30,
      source: 'personal',
    });
  });

  it('单次手填只改最近一次预留，不改个人默认', () => {
    const preferences = withPersonalReserve(emptyReservePreferences(), 'custom', 90);
    const after = withLastReserve(preferences, 'custom', 40);
    expect(after.personal.custom).toBe(90);
    expect(after.last.custom).toBe(40);
    expect(preferences.last.custom).toBeUndefined();
  });
});
