import { describe, expect, it } from 'vitest';
import {
  CROPS,
  activateBatch,
  createPlannedBatch,
  createPlannerState,
  cropByKey,
  cropGrowth,
  dateKey,
  identityKey,
  manualIdentity,
  recordWatering,
  reducePlanner,
} from '../../src/core';
import type { CropBatch, GameDate } from '../../src/core';

const day1: GameDate = { year: 1, season: 0, day: 1 };
const day2: GameDate = { year: 1, season: 0, day: 2 };
const day3: GameDate = { year: 1, season: 0, day: 3 };
const day4: GameDate = { year: 1, season: 0, day: 4 };
const day5: GameDate = { year: 1, season: 0, day: 5 };
const day6: GameDate = { year: 1, season: 0, day: 6 };
const day7: GameDate = { year: 1, season: 0, day: 7 };
const day8: GameDate = { year: 1, season: 0, day: 8 };
const day10: GameDate = { year: 1, season: 0, day: 10 };

function planned(overrides: Partial<Parameters<typeof createPlannedBatch>[2]> = {}): CropBatch {
  return createPlannedBatch('batch-1', 'manual:plant', {
    cropKey: 'parsnip',
    environment: 'outdoor',
    fertilizer: 'none',
    plantCount: 10,
    ...overrides,
  });
}

function water(batch: CropBatch, date: GameDate, count: number): CropBatch {
  return recordWatering(batch, date, count, `split-${dateKey(date)}`)[0]!;
}

describe('内置作物数据快照', () => {
  it('支持范围内作物带首次生长天数与重复收获间隔', () => {
    expect(cropByKey('parsnip')).toMatchObject({
      name: '防风草',
      growthDays: 4,
      regrowDays: null,
      condition: 'supported',
    });
    expect(cropByKey('blueberry')).toMatchObject({ growthDays: 13, regrowDays: 4 });
    expect(cropByKey('ancient_fruit')).toMatchObject({ growthDays: 28, regrowDays: 7 });
    expect(CROPS.filter((crop) => crop.condition === 'supported')).toHaveLength(40);
  });

  it('格子作物与水田作物标记为特殊条件，V1 没有可用生长天数', () => {
    expect(cropByKey('grape')?.condition).toBe('raised');
    expect(cropByKey('green_bean')?.condition).toBe('raised');
    expect(cropByKey('taro_root')?.condition).toBe('paddy');
    expect(cropByKey('unmilled_rice')?.condition).toBe('paddy');
    expect(cropByKey('grape')?.growthDays).toBeNull();
  });

  it('未知作物键查不到定义', () => {
    expect(cropByKey('dragon_fruit')).toBeUndefined();
  });
});

describe('作物批次：计划与种植转换', () => {
  it('计划中的种植只建立计划批次，没有实际种植日期', () => {
    const batch = planned();
    expect(batch).toMatchObject({
      status: 'planned',
      plantedOn: null,
      cropName: '防风草',
      plantCount: 10,
      supply: [],
    });
  });

  it('种植活动实际完成后按实际完成日转为已种植批次', () => {
    const planted = activateBatch(planned(), day2);
    expect(planted).toMatchObject({ status: 'planted', plantedOn: day2 });
  });

  it('自定义作物名称按玩家填写保留', () => {
    const batch = createPlannedBatch('b', 'manual:p', {
      cropKey: null,
      cropName: '魔法豆',
      environment: 'outdoor',
      fertilizer: 'none',
      plantCount: 3,
    });
    expect(batch.cropName).toBe('魔法豆');
  });
});

describe('生长推算：支持范围内的首次收获', () => {
  it('每个已供水日推进一天生长，首次收获在最后一个生长日之后', () => {
    let batch = activateBatch(planned(), day1);
    for (const date of [day1, day2, day3, day4]) batch = water(batch, date, 10);

    const growth = cropGrowth(batch, day10);
    expect(growth).toEqual({
      status: 'growing',
      firstHarvest: day5,
      growthDays: 4,
      wateredDays: 4,
      stalledDays: 0,
      conditional: false,
    });
  });

  it('支持范围内漏浇一天，预计收获日期相应顺延', () => {
    let batch = activateBatch(planned(), day1);
    // 第 3 天没有供水记录（历史），按漏浇处理。
    for (const date of [day1, day2, day4, day5]) batch = water(batch, date, 10);

    const growth = cropGrowth(batch, day10);
    expect(growth).toMatchObject({ status: 'growing', firstHarvest: day6, stalledDays: 1 });
  });

  it('历史日期缺供水记录按漏浇处理，不推进生长', () => {
    let batch = activateBatch(planned(), day1);
    batch = water(batch, day1, 10);
    // 第 2、3 天缺记录，只有第 1、4、5、6 天供水。
    for (const date of [day4, day5, day6]) batch = water(batch, date, 10);

    const growth = cropGrowth(batch, day8);
    expect(growth).toMatchObject({
      status: 'growing',
      firstHarvest: day7,
      stalledDays: 2,
      conditional: false,
    });
  });

  it('未来日期缺记录只作预测，结果标为条件性预计', () => {
    let batch = activateBatch(planned(), day1);
    batch = water(batch, day1, 10);

    const growth = cropGrowth(batch, day1);
    expect(growth).toMatchObject({
      status: 'growing',
      firstHarvest: day5,
      conditional: true,
    });
  });

  it('计划批次不推算日期', () => {
    expect(cropGrowth(planned(), day10)).toEqual({ status: 'planned' });
  });
});

describe('生长推算：规则未验证的条件', () => {
  it('温室批次不给自动推算日期', () => {
    const growth = cropGrowth(activateBatch(planned({ environment: 'greenhouse' }), day1), day10);
    expect(growth.status).toBe('unverified');
    if (growth.status !== 'unverified') return;
    expect(growth.reason).toContain('温室条件');
  });

  it('施肥批次不给自动推算日期', () => {
    const growth = cropGrowth(activateBatch(planned({ fertilizer: 'fertilized' }), day1), day10);
    expect(growth.status).toBe('unverified');
    if (growth.status !== 'unverified') return;
    expect(growth.reason).toContain('肥料条件');
  });

  it('格子作物与水田作物不给自动推算日期', () => {
    const raised = cropGrowth(activateBatch(planned({ cropKey: 'grape' }), day1), day10);
    expect(raised.status).toBe('unverified');
    if (raised.status !== 'unverified') return;
    expect(raised.reason).toContain('格子作物');

    const paddy = cropGrowth(activateBatch(planned({ cropKey: 'taro_root' }), day1), day10);
    expect(paddy.status).toBe('unverified');
    if (paddy.status !== 'unverified') return;
    expect(paddy.reason).toContain('水田作物');
  });

  it('未知/自定义作物不给自动推算日期', () => {
    const custom = createPlannedBatch('b', 'manual:p', {
      cropKey: null,
      cropName: '魔法豆',
      environment: 'outdoor',
      fertilizer: 'none',
      plantCount: 3,
    });
    const growth = cropGrowth(activateBatch(custom, day1), day10);
    expect(growth.status).toBe('unverified');
    if (growth.status !== 'unverified') return;
    expect(growth.reason).toContain('未知作物');
  });
});

describe('部分供水：显式拆分批次', () => {
  it('10 株中 6 株供水时拆成 6/4 两批，分别推算且不猜具体植株', () => {
    let batch = activateBatch(planned(), day2);
    batch = water(batch, day2, 10);

    const split = recordWatering(batch, day3, 6, 'split-1');
    expect(split).toHaveLength(2);
    const [watered, dry] = split as [CropBatch, CropBatch];
    expect(watered.plantCount).toBe(6);
    expect(dry.plantCount).toBe(4);
    expect(watered.supply).toEqual([dateKey(day2), dateKey(day3)]);
    expect(dry.supply).toEqual([dateKey(day2)]);

    let a = watered;
    for (const date of [day4, day5]) a = water(a, date, 6);
    let b = dry;
    for (const date of [day4, day5, day6]) b = water(b, date, 4);

    expect(cropGrowth(a, day10)).toMatchObject({ status: 'growing', firstHarvest: day6 });
    expect(cropGrowth(b, day10)).toMatchObject({ status: 'growing', firstHarvest: day7 });
  });

  it('全部供水只补一条记录，不拆分', () => {
    const batch = activateBatch(planned(), day2);
    const split = recordWatering(batch, day2, 10, 'split-1');
    expect(split).toHaveLength(1);
    expect(split[0]!.plantCount).toBe(10);
  });

  it('零供水不产生记录', () => {
    const batch = activateBatch(planned(), day2);
    expect(recordWatering(batch, day2, 0, 'split-1')).toEqual([batch]);
  });
});

describe('作物批次的 reducer 集成', () => {
  function addPlant(
    state: ReturnType<typeof createPlannerState>,
    id: string,
    crop?: Partial<Parameters<typeof createPlannedBatch>[2]>,
  ) {
    return reducePlanner(state, {
      kind: 'addActivity',
      identity: manualIdentity(id),
      activityType: 'plant',
      name: '种植',
      start: 360,
      crop: {
        id: `batch-${id}`,
        cropKey: 'parsnip',
        environment: 'outdoor',
        fertilizer: 'none',
        plantCount: 10,
        ...crop,
      },
    });
  }

  it('添加种植活动时建立计划批次，并记录来源活动身份', () => {
    const state = addPlant(createPlannerState(day1, 'single'), 'p');
    expect(state.cropBatches).toHaveLength(1);
    expect(state.cropBatches[0]).toMatchObject({
      id: 'batch-p',
      sourceKey: identityKey(manualIdentity('p')),
      status: 'planned',
    });
  });

  it('完成种植活动按当前游戏日激活批次；撤销完成退回计划批次', () => {
    let state = addPlant(createPlannerState(day1, 'single'), 'p');
    state = { ...state, currentDay: day2 };
    const key = identityKey(manualIdentity('p'));
    state = reducePlanner(state, { kind: 'toggleActivityCompleted', key, completed: true });
    expect(state.cropBatches[0]).toMatchObject({ status: 'planted', plantedOn: day2 });

    state = reducePlanner(state, { kind: 'toggleActivityCompleted', key, completed: false });
    expect(state.cropBatches[0]).toMatchObject({ status: 'planned', plantedOn: null, supply: [] });
  });

  it('不同作物、种植日期、环境或肥料条件的批次各自独立', () => {
    let state = addPlant(createPlannerState(day1, 'single'), 'a');
    state = addPlant(state, 'b', { cropKey: 'blueberry' });
    state = addPlant(state, 'c', { environment: 'greenhouse' });
    state = addPlant(state, 'd', { fertilizer: 'fertilized' });
    expect(state.cropBatches).toHaveLength(4);
    expect(new Set(state.cropBatches.map((batch) => batch.id)).size).toBe(4);
  });

  it('记录供水命令按数量拆分批次', () => {
    let state = addPlant(createPlannerState(day1, 'single'), 'p');
    state = { ...state, currentDay: day2 };
    state = reducePlanner(state, {
      kind: 'toggleActivityCompleted',
      key: identityKey(manualIdentity('p')),
      completed: true,
    });
    state = reducePlanner(state, {
      kind: 'recordCropSupply',
      batchId: 'batch-p',
      date: day3,
      wateredCount: 6,
      splitId: 'split-1',
    });
    expect(state.cropBatches).toHaveLength(2);
    expect(state.cropBatches.map((batch) => batch.plantCount).sort((a, b) => a - b)).toEqual([4, 6]);
  });

  it('删除种植活动只移除未种植的计划批次，已种植批次保留', () => {
    let state = addPlant(createPlannerState(day1, 'single'), 'planned');
    state = addPlant(state, 'planted');
    state = reducePlanner(state, {
      kind: 'toggleActivityCompleted',
      key: identityKey(manualIdentity('planted')),
      completed: true,
    });
    state = reducePlanner(state, {
      kind: 'deleteActivity',
      key: identityKey(manualIdentity('planned')),
    });
    state = reducePlanner(state, {
      kind: 'deleteActivity',
      key: identityKey(manualIdentity('planted')),
    });
    expect(state.cropBatches).toHaveLength(1);
    expect(state.cropBatches[0]).toMatchObject({ sourceKey: identityKey(manualIdentity('planted')) });
  });

  it('非种植活动不建立批次', () => {
    const state = reducePlanner(createPlannerState(day1, 'single'), {
      kind: 'addActivity',
      identity: manualIdentity('w'),
      activityType: 'water',
      name: '浇水',
      start: 360,
    });
    expect(state.cropBatches).toEqual([]);
  });
});
