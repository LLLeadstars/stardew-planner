import type { GameDate, Season } from './date';
import { addDays, compareDate, dateKey } from './date';

/**
 * 作物规则支持范围（CONTEXT.md）：
 * V1 只对「普通室外耕地、无肥料」且在内置数据快照中的基础作物自动推算生长；
 * 格子作物、水田作物、采集类作物、温室与肥料条件仍可建立批次，但标记为「规则未验证」，
 * 由玩家手动记录预计日期与照料安排。
 */

/** 作物在快照中的条件分类；只有 supported 会给出自动推算。 */
export type CropCondition = 'supported' | 'raised' | 'paddy' | 'forage';

export type CropDefinition = {
  /** 稳定键，用于存档与比较；不随展示名称变化。 */
  key: string;
  /** 展示名称。 */
  name: string;
  /** 数据记录允许的种植季节；只作参考，不足以推出跨季存活。 */
  seasons: readonly Season[];
  /** 首次生长天数；特殊条件作物在 V1 没有可用数据。 */
  growthDays: number | null;
  /** 重复收获间隔；一次收获作物为 null。 */
  regrowDays: number | null;
  condition: CropCondition;
};

/**
 * 内置作物数据快照：PC 原版 1.6.15、无模组。
 * 数值取自 docs/research/stardew-crops-1.6.15.md 的固定数据集，
 * 是游戏数据字段而非对玩家耗时的预测。
 */
export const CROPS: readonly CropDefinition[] = [
  // 支持范围：普通室外耕地、无肥料（40 条默认数据条目）
  { key: 'amaranth', name: '苋菜', seasons: [2], growthDays: 7, regrowDays: null, condition: 'supported' },
  { key: 'ancient_fruit', name: '远古水果', seasons: [0, 1, 2], growthDays: 28, regrowDays: 7, condition: 'supported' },
  { key: 'artichoke', name: '洋蓟', seasons: [2], growthDays: 8, regrowDays: null, condition: 'supported' },
  { key: 'beet', name: '甜菜', seasons: [2], growthDays: 6, regrowDays: null, condition: 'supported' },
  { key: 'blue_jazz', name: '蓝爵花', seasons: [0], growthDays: 7, regrowDays: null, condition: 'supported' },
  { key: 'blueberry', name: '蓝莓', seasons: [1], growthDays: 13, regrowDays: 4, condition: 'supported' },
  { key: 'bok_choy', name: '小白菜', seasons: [2], growthDays: 4, regrowDays: null, condition: 'supported' },
  { key: 'broccoli', name: '西兰花', seasons: [2], growthDays: 8, regrowDays: 4, condition: 'supported' },
  { key: 'carrot', name: '胡萝卜', seasons: [0], growthDays: 3, regrowDays: null, condition: 'supported' },
  { key: 'cauliflower', name: '花椰菜', seasons: [0], growthDays: 12, regrowDays: null, condition: 'supported' },
  { key: 'coffee_bean', name: '咖啡豆', seasons: [0, 1], growthDays: 10, regrowDays: 2, condition: 'supported' },
  { key: 'corn', name: '玉米', seasons: [1, 2], growthDays: 14, regrowDays: 4, condition: 'supported' },
  { key: 'cranberries', name: '蔓越莓', seasons: [2], growthDays: 7, regrowDays: 5, condition: 'supported' },
  { key: 'eggplant', name: '茄子', seasons: [2], growthDays: 5, regrowDays: 5, condition: 'supported' },
  { key: 'fairy_rose', name: '仙女玫瑰', seasons: [2], growthDays: 12, regrowDays: null, condition: 'supported' },
  { key: 'fiber', name: '纤维', seasons: [0, 1, 2, 3], growthDays: 7, regrowDays: null, condition: 'supported' },
  { key: 'garlic', name: '大蒜', seasons: [0], growthDays: 4, regrowDays: null, condition: 'supported' },
  { key: 'hot_pepper', name: '辣椒', seasons: [1], growthDays: 5, regrowDays: 3, condition: 'supported' },
  { key: 'kale', name: '羽衣甘蓝', seasons: [0], growthDays: 6, regrowDays: null, condition: 'supported' },
  { key: 'melon', name: '甜瓜', seasons: [1], growthDays: 12, regrowDays: null, condition: 'supported' },
  { key: 'parsnip', name: '防风草', seasons: [0], growthDays: 4, regrowDays: null, condition: 'supported' },
  { key: 'pineapple', name: '菠萝', seasons: [1], growthDays: 14, regrowDays: 7, condition: 'supported' },
  { key: 'poppy', name: '虞美人', seasons: [1], growthDays: 7, regrowDays: null, condition: 'supported' },
  { key: 'potato', name: '土豆', seasons: [0], growthDays: 6, regrowDays: null, condition: 'supported' },
  { key: 'powdermelon', name: '能量甜瓜', seasons: [3], growthDays: 7, regrowDays: null, condition: 'supported' },
  { key: 'pumpkin', name: '南瓜', seasons: [2], growthDays: 13, regrowDays: null, condition: 'supported' },
  { key: 'qi_fruit', name: '齐果', seasons: [0, 1, 2, 3], growthDays: 4, regrowDays: null, condition: 'supported' },
  { key: 'radish', name: '萝卜', seasons: [1], growthDays: 6, regrowDays: null, condition: 'supported' },
  { key: 'red_cabbage', name: '红甘蓝', seasons: [1], growthDays: 9, regrowDays: null, condition: 'supported' },
  { key: 'rhubarb', name: '大黄', seasons: [0], growthDays: 13, regrowDays: null, condition: 'supported' },
  { key: 'starfruit', name: '杨桃', seasons: [1], growthDays: 13, regrowDays: null, condition: 'supported' },
  { key: 'strawberry', name: '草莓', seasons: [0], growthDays: 8, regrowDays: 4, condition: 'supported' },
  { key: 'summer_spangle', name: '夏日亮片', seasons: [1], growthDays: 8, regrowDays: null, condition: 'supported' },
  { key: 'summer_squash', name: '西葫芦', seasons: [1], growthDays: 6, regrowDays: 3, condition: 'supported' },
  { key: 'sunflower', name: '向日葵', seasons: [1, 2], growthDays: 8, regrowDays: null, condition: 'supported' },
  { key: 'sweet_gem_berry', name: '甜蜜宝石果', seasons: [2], growthDays: 24, regrowDays: null, condition: 'supported' },
  { key: 'tomato', name: '番茄', seasons: [1], growthDays: 11, regrowDays: 4, condition: 'supported' },
  { key: 'tulip', name: '郁金香', seasons: [0], growthDays: 6, regrowDays: null, condition: 'supported' },
  { key: 'wheat', name: '小麦', seasons: [1, 2], growthDays: 4, regrowDays: null, condition: 'supported' },
  { key: 'yam', name: '山药', seasons: [2], growthDays: 10, regrowDays: null, condition: 'supported' },

  // 特殊条件：不在默认矩阵内，V1 不自动推算生长
  { key: 'grape', name: '葡萄', seasons: [], growthDays: null, regrowDays: null, condition: 'raised' },
  { key: 'green_bean', name: '四季豆', seasons: [], growthDays: null, regrowDays: null, condition: 'raised' },
  { key: 'hops', name: '啤酒花', seasons: [], growthDays: null, regrowDays: null, condition: 'raised' },
  { key: 'taro_root', name: '芋头', seasons: [], growthDays: null, regrowDays: null, condition: 'paddy' },
  { key: 'unmilled_rice', name: '稻谷', seasons: [], growthDays: null, regrowDays: null, condition: 'paddy' },
  { key: 'cactus_fruit', name: '仙人掌果', seasons: [], growthDays: null, regrowDays: null, condition: 'forage' },
  { key: 'common_mushroom', name: '普通蘑菇', seasons: [], growthDays: null, regrowDays: null, condition: 'forage' },
  { key: 'spice_berry', name: '香味浆果', seasons: [], growthDays: null, regrowDays: null, condition: 'forage' },
  { key: 'wild_horseradish', name: '野山葵', seasons: [], growthDays: null, regrowDays: null, condition: 'forage' },
  { key: 'winter_root', name: '冬根', seasons: [], growthDays: null, regrowDays: null, condition: 'forage' },
];

export function cropByKey(key: string): CropDefinition | undefined {
  return CROPS.find((crop) => crop.key === key);
}

/** 存档校验：作物键要么为空（自定义作物），要么是快照里的已知键。 */
export function isCropKey(value: unknown): value is string {
  return typeof value === 'string' && cropByKey(value) !== undefined;
}

export const CROP_CONDITION_LABELS: Record<CropCondition, string> = {
  supported: '支持范围（普通室外、无肥料）',
  raised: '格子作物',
  paddy: '水田作物',
  forage: '采集/野生作物',
};

/** 种植环境。温室条件在 V1 没有已核验的生长规则。 */
export type CropEnvironment = 'outdoor' | 'greenhouse';

export const CROP_ENVIRONMENT_LABELS: Record<CropEnvironment, string> = {
  outdoor: '普通室外耕地',
  greenhouse: '温室',
};

/** 肥料条件。V1 只在无肥料条件下自动推算。 */
export type CropFertilizer = 'none' | 'fertilized';

export const CROP_FERTILIZER_LABELS: Record<CropFertilizer, string> = {
  none: '无肥料',
  fertilized: '已施肥',
};

/** 建立批次时玩家填写的字段；批次 id 与来源键由调用方给出。 */
export type NewCropBatchFields = {
  cropKey: string | null;
  /** 自定义作物名称；cropKey 命中快照时以快照名称为准。 */
  cropName?: string;
  environment: CropEnvironment;
  fertilizer: CropFertilizer;
  plantCount: number;
};

export const CUSTOM_CROP_NAME = '自定义作物';

/** cropKey 命中快照时取快照名称，否则用玩家填写的名称。 */
export function resolveCropName(cropKey: string | null, customName?: string): string {
  if (cropKey) {
    const definition = cropByKey(cropKey);
    if (definition) return definition.name;
  }
  const trimmed = customName?.trim();
  return trimmed ? trimmed : CUSTOM_CROP_NAME;
}

export type CropBatchStatus = 'planned' | 'planted';

/**
 * 作物批次：同一种作物、同一实际种植日期、相同环境与肥料条件及每日供水情况的一组作物。
 * 计划批次随种植活动建立；种植活动实际完成后转为已种植并开始生长推进。
 * 部分供水按玩家填写的数量显式拆分为已供水和未供水批次，不猜测具体植株。
 */
export type CropBatch = {
  id: string;
  /** 来源种植活动的身份键；种植活动完成后据此激活批次。 */
  sourceKey: string;
  cropKey: string | null;
  cropName: string;
  environment: CropEnvironment;
  fertilizer: CropFertilizer;
  plantCount: number;
  status: CropBatchStatus;
  /** 实际种植日期；计划批次为 null。 */
  plantedOn: GameDate | null;
  /** 每日供水记录（日期键），全部植株供水才记入。 */
  supply: string[];
};

export function createPlannedBatch(
  id: string,
  sourceKey: string,
  fields: NewCropBatchFields,
): CropBatch {
  return {
    id,
    sourceKey,
    cropKey: fields.cropKey,
    cropName: resolveCropName(fields.cropKey, fields.cropName),
    environment: fields.environment,
    fertilizer: fields.fertilizer,
    plantCount: Math.max(1, Math.floor(fields.plantCount)),
    status: 'planned',
    plantedOn: null,
    supply: [],
  };
}

/** 种植活动实际完成：按实际完成日转为已种植批次并开始生长推进。 */
export function activateBatch(batch: CropBatch, date: GameDate): CropBatch {
  return { ...batch, status: 'planted', plantedOn: date };
}

/** 撤销种植完成：退回计划批次，尚未开始生长，清空供水记录。 */
export function deactivateBatch(batch: CropBatch): CropBatch {
  return { ...batch, status: 'planned', plantedOn: null, supply: [] };
}

/** 编辑批次条件；作物键变化时同步展示名称。 */
export function updateBatch(batch: CropBatch, patch: Partial<NewCropBatchFields>): CropBatch {
  const cropKey = patch.cropKey !== undefined ? patch.cropKey : batch.cropKey;
  const customName = patch.cropName !== undefined ? patch.cropName : batch.cropName;
  return {
    ...batch,
    cropKey,
    cropName: resolveCropName(cropKey, customName),
    environment: patch.environment ?? batch.environment,
    fertilizer: patch.fertilizer ?? batch.fertilizer,
    plantCount:
      patch.plantCount === undefined ? batch.plantCount : Math.max(1, Math.floor(patch.plantCount)),
  };
}

/**
 * 记录某日供水。全部植株供水时只补一条记录；
 * 部分供水时把原批次留给已供水植株，另建未供水批次，由玩家分别照料。
 * `splitId` 由调用方生成，仅在确实拆分时使用。
 */
export function recordWatering(
  batch: CropBatch,
  date: GameDate,
  wateredCount: number,
  splitId: string,
): CropBatch[] {
  const total = batch.plantCount;
  const count = Math.max(0, Math.min(Math.floor(wateredCount), total));
  if (count <= 0) return [batch];
  const key = dateKey(date);
  const watered: CropBatch = {
    ...batch,
    plantCount: count,
    supply: batch.supply.includes(key) ? batch.supply : [...batch.supply, key],
  };
  if (count >= total) return [watered];
  const dry: CropBatch = { ...batch, id: splitId, plantCount: total - count };
  return [watered, dry];
}

export type CropGrowth =
  | { status: 'planned' }
  | { status: 'unverified'; reason: string }
  | {
      status: 'growing';
      /** 首次预计收获日期；重复收获的后续轮次由后续切片处理。 */
      firstHarvest: GameDate;
      growthDays: number;
      wateredDays: number;
      /** 已过去但没有供水记录、按漏浇处理的天数。 */
      stalledDays: number;
      /** 依赖对未来日期的预测（尚无供水记录）时为 true，不写成已发生事实。 */
      conditional: boolean;
    };

/** 返回「规则未验证」的原因；支持范围内返回 null。 */
export function cropRuleIssue(
  batch: Pick<CropBatch, 'cropKey' | 'environment' | 'fertilizer'>,
): string | null {
  const definition = batch.cropKey ? cropByKey(batch.cropKey) : undefined;
  const causes: string[] = [];
  if (!definition) causes.push('未知作物');
  else if (definition.condition === 'raised') causes.push('格子作物');
  else if (definition.condition === 'paddy') causes.push('水田作物');
  else if (definition.condition === 'forage') causes.push('采集/野生作物');
  if (batch.environment === 'greenhouse') causes.push('温室条件');
  if (batch.fertilizer !== 'none') causes.push('肥料条件');
  if (definition && definition.growthDays === null) causes.push('缺少生长天数数据');
  if (!causes.length) return null;
  return `规则未验证：${causes.join('、')}不在 V1 支持范围内。`;
}

/** 支持范围内，每个已供水日推进一天生长；未供水日不推进，预计收获日顺延。 */
export function cropGrowth(batch: CropBatch, currentDay: GameDate): CropGrowth {
  if (batch.status !== 'planted' || !batch.plantedOn) return { status: 'planned' };

  const definition = batch.cropKey ? cropByKey(batch.cropKey) : undefined;
  const issue = cropRuleIssue(batch);
  if (issue || !definition || definition.growthDays === null) {
    return { status: 'unverified', reason: issue ?? '规则未验证：缺少可用数据不在 V1 支持范围内。' };
  }

  const growthDays = definition.growthDays;
  let wateredDays = 0;
  let stalledDays = 0;
  let conditional = false;
  let date = batch.plantedOn;

  for (let guard = 0; guard < 4000; guard += 1) {
    const recorded = batch.supply.includes(dateKey(date));
    if (recorded) {
      wateredDays += 1;
    } else if (compareDate(date, currentDay) < 0) {
      // 历史日期缺供水记录按漏浇处理，不推进生长。
      stalledDays += 1;
    } else {
      // 未来日期（含今天）缺记录只作预测：假定正常供水，标为条件性预计。
      wateredDays += 1;
      conditional = true;
    }
    if (wateredDays >= growthDays) {
      return {
        status: 'growing',
        firstHarvest: addDays(date, 1),
        growthDays,
        wateredDays,
        stalledDays,
        conditional,
      };
    }
    date = addDays(date, 1);
  }
  return {
    status: 'growing',
    firstHarvest: addDays(date, 1),
    growthDays,
    wateredDays,
    stalledDays,
    conditional: true,
  };
}
