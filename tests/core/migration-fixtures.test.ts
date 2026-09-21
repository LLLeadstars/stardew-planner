import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inspectBackup } from '../../src/core';

/**
 * 旧格式夹具：真实存档形状的 JSON 文件。
 * 迁移管线每次改动版本都应先让这些夹具通过，再发布新版本。
 */
function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8');
}

describe('旧格式夹具迁移', () => {
  it('v1 夹具补齐活动类型与空预留偏好', () => {
    const result = inspectBackup(fixture('storage-v1.json'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.version).toBe(1);
    expect(result.state.activities[0]).toMatchObject({
      activityType: 'custom',
      name: '看电视',
      start: 370,
    });
    expect(result.state.reserves).toEqual({ personal: {}, last: {} });
    expect(result.state.playerStates).toEqual({});
    expect(result.preview.activityCount).toBe(1);
  });

  it('v2 夹具保留活动类型、预留偏好与受保护标记', () => {
    const result = inspectBackup(fixture('storage-v2.json'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.version).toBe(2);
    expect(result.state.mode).toBe('multi');
    expect(result.state.activities[0]?.activityType).toBe('fishing');
    expect(result.state.activities[0]?.protection.editedByPlayer).toBe(true);
    expect(result.state.reserves).toEqual({ personal: { fishing: 150 }, last: { fishing: 120 } });
    expect(result.preview.personalReserveCount).toBe(1);
  });

  it('v3 夹具保留当次信息并补上空的玩家状态', () => {
    const result = inspectBackup(fixture('storage-v3.json'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.version).toBe(3);
    expect(result.state.playerStates).toEqual({});
    expect(result.state.activities[0]).toMatchObject({
      activityType: 'shop',
      note: '买防风草种子',
      checklist: ['防风草种子 ×10', '肥料 ×2'],
      details: { place: '镇上' },
    });
  });

  it('v4 夹具保留玩家状态，只缺少后续版本引入的门店与购物清单字段', () => {
    const result = inspectBackup(fixture('storage-v4.json'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.version).toBe(4);
    expect(result.state.playerStates).toEqual({
      weather: 'sunny',
      communityCenter: 'notRestored',
      toolLevels: { axe: 'copper' },
    });
    expect(result.state.activities[0]?.details).toBeUndefined();
    expect(result.state.activities[1]?.details).toEqual({ place: '铁匠铺' });
    expect(result.preview.playerStateCount).toBe(3); // weather + communityCenter + axe 等级
  });
});
