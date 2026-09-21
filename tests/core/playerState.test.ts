import { describe, expect, it } from 'vitest';
import {
  activityStateSummary,
  createPlannerState,
  reducePlanner,
  requiredStateKeys,
  requiredStateRows,
} from '../../src/core';
import { makeActivity } from '../helpers';

const day = { year: 1, season: 0, day: 3 } as const;

describe('本日依赖的玩家状态', () => {
  it('没有活动时不依赖任何玩家状态', () => {
    expect(requiredStateKeys([])).toEqual([]);
    expect(requiredStateRows([], {})).toEqual([]);
  });

  it('购物活动依赖社区中心状态与城镇钥匙', () => {
    const activities = [makeActivity({ start: 540, duration: 60, activityType: 'shop' })];
    expect(requiredStateKeys(activities)).toEqual(['communityCenter', 'townKey']);
  });

  it('购物活动按所选门店依赖不同条件', () => {
    const carpenter = [
      makeActivity({ start: 540, duration: 60, activityType: 'shop', details: { shop: 'carpenter' } }),
    ];
    expect(requiredStateKeys(carpenter)).toEqual(['robinWorking']);
    const blacksmith = [
      makeActivity({ start: 540, duration: 60, activityType: 'shop', details: { shop: 'blacksmith' } }),
    ];
    expect(requiredStateKeys(blacksmith)).toEqual(['communityCenter']);
  });

  it('工具交付与取回依赖工具等级，多个活动只列一次', () => {
    const activities = [
      makeActivity({ start: 540, duration: 60, activityType: 'toolGive' }),
      makeActivity({ start: 700, duration: 60, activityType: 'toolTake' }),
    ];
    expect(requiredStateKeys(activities)).toEqual(['toolLevels']);
  });

  it('自定义活动不依赖任何玩家状态', () => {
    const activities = [makeActivity({ start: 540, duration: 60, activityType: 'custom' })];
    expect(requiredStateKeys(activities)).toEqual([]);
  });
});

describe('左栏状态行与影响说明', () => {
  it('未填写时状态行说明判断保持未知', () => {
    const activities = [makeActivity({ start: 540, duration: 60, activityType: 'shop' })];
    const rows = requiredStateRows(activities, {});
    expect(rows.map((row) => row.label)).toEqual(['社区中心状态', '城镇钥匙']);
    expect(rows[0]?.valueLabel).toBe('未填写');
    expect(rows[0]?.impact).toContain('未填写');
  });

  it('已填写的状态在影响说明里显示当前取值', () => {
    const activities = [makeActivity({ start: 540, duration: 60, activityType: 'shop' })];
    const rows = requiredStateRows(activities, { communityCenter: 'restored', townKey: 'yes' });
    expect(rows[0]?.valueLabel).toBe('已修复');
    expect(rows[0]?.impact).toContain('已修复');
    expect(rows[1]?.valueLabel).toBe('持有');
    expect(rows[1]?.impact).toContain('持有');
  });

  it('工具等级按工具列出已记录的等级', () => {
    const activities = [makeActivity({ start: 540, duration: 60, activityType: 'toolGive' })];
    const rows = requiredStateRows(activities, { toolLevels: { can: 'copper' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.valueLabel).toBe('喷壶 铜');
    expect(rows[0]?.impact).toContain('喷壶 铜');
  });
});

describe('活动卡片的状态摘要', () => {
  it('没有依赖的活动不显示摘要', () => {
    const activity = makeActivity({ start: 540, duration: 60, activityType: 'custom' });
    expect(activityStateSummary(activity, {})).toBeNull();
  });

  it('购物活动显示社区中心与城镇钥匙的当前取值', () => {
    const activity = makeActivity({ start: 540, duration: 60, activityType: 'shop' });
    expect(activityStateSummary(activity, {})).toBe('社区中心状态：未填写 · 城镇钥匙：未填写');
    expect(activityStateSummary(activity, { communityCenter: 'restored', townKey: 'no' })).toBe(
      '社区中心状态：已修复 · 城镇钥匙：未持有',
    );
  });
});

describe('reducer：就地把玩家状态写回', () => {
  it('初始状态不含任何玩家状态', () => {
    expect(createPlannerState(day, 'single').playerStates).toEqual({});
  });

  it('设置社区中心与城镇钥匙只改玩家状态', () => {
    let state = createPlannerState(day, 'single');
    state = reducePlanner(state, { kind: 'setCommunityCenter', value: 'restored' });
    state = reducePlanner(state, { kind: 'setTownKey', value: 'no' });
    expect(state.playerStates).toEqual({ communityCenter: 'restored', townKey: 'no' });
    expect(state.activities).toEqual([]);
    expect(state.currentDay).toEqual(day);
  });

  it('工具等级可逐项设置与清除', () => {
    let state = createPlannerState(day, 'single');
    state = reducePlanner(state, { kind: 'setToolLevel', tool: 'can', level: 'copper' });
    state = reducePlanner(state, { kind: 'setToolLevel', tool: 'axe', level: 'steel' });
    expect(state.playerStates.toolLevels).toEqual({ can: 'copper', axe: 'steel' });
    state = reducePlanner(state, { kind: 'setToolLevel', tool: 'can' });
    expect(state.playerStates.toolLevels).toEqual({ axe: 'steel' });
  });

  it('天气与特殊日作为今天的前提写入，也可清空', () => {
    let state = createPlannerState(day, 'single');
    state = reducePlanner(state, { kind: 'setWeather', value: 'rain' });
    state = reducePlanner(state, { kind: 'setSpecialDay', value: 'festival' });
    expect(state.playerStates.weather).toBe('rain');
    expect(state.playerStates.specialDay).toBe('festival');
    state = reducePlanner(state, { kind: 'setWeather' });
    expect(state.playerStates.weather).toBeUndefined();
  });

  it('罗宾施工状态可设置与清除', () => {
    let state = createPlannerState(day, 'single');
    state = reducePlanner(state, { kind: 'setRobinWorking', value: 'yes' });
    expect(state.playerStates.robinWorking).toBe('yes');
    state = reducePlanner(state, { kind: 'setRobinWorking' });
    expect(state.playerStates.robinWorking).toBeUndefined();
  });
});
