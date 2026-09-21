import {
  CROPS,
  CROP_CONDITION_LABELS,
  CROP_ENVIRONMENT_LABELS,
  CROP_FERTILIZER_LABELS,
  SEASON_NAMES,
  cropByKey,
  cropRuleIssue,
} from '../core';
import type { CropEnvironment, CropFertilizer, NewCropBatchFields } from '../core';

/**
 * 作物批次条件：作物、株数、环境与肥料。
 * 添加弹层与检查器共用，保证两处的可选项与「规则未验证」提示一致。
 */
export type CropFieldsValue = {
  cropKey: string | null;
  cropName: string;
  /** 选择「自定义作物」时为 true；cropKey 为 null。 */
  custom: boolean;
  environment: CropEnvironment;
  fertilizer: CropFertilizer;
  plantCount: number;
};

export const DEFAULT_CROP_FIELDS: CropFieldsValue = {
  cropKey: null,
  cropName: '',
  custom: false,
  environment: 'outdoor',
  fertilizer: 'none',
  plantCount: 1,
};

const CUSTOM = '__custom__';

export function cropFieldsFromBatch(batch: {
  cropKey: string | null;
  cropName: string;
  environment: CropEnvironment;
  fertilizer: CropFertilizer;
  plantCount: number;
}): CropFieldsValue {
  return {
    cropKey: batch.cropKey,
    cropName: batch.cropKey === null ? batch.cropName : '',
    custom: batch.cropKey === null,
    environment: batch.environment,
    fertilizer: batch.fertilizer,
    plantCount: batch.plantCount,
  };
}

/** 转换为核心的批次字段；未选择作物时不应调用。 */
export function cropFieldsToBatchFields(value: CropFieldsValue): NewCropBatchFields {
  return {
    cropKey: value.cropKey,
    cropName: value.custom ? value.cropName.trim() || undefined : undefined,
    environment: value.environment,
    fertilizer: value.fertilizer,
    plantCount: value.plantCount,
  };
}

/** 真的选了作物（内置或自定义）才建立批次。 */
export function cropFieldsChosen(value: CropFieldsValue): boolean {
  return value.custom || value.cropKey !== null;
}

type Props = {
  value: CropFieldsValue;
  onChange: (next: CropFieldsValue) => void;
};

export function CropBatchFields({ value, onChange }: Props) {
  const supported = CROPS.filter((crop) => crop.condition === 'supported');
  const special = CROPS.filter((crop) => crop.condition !== 'supported');
  const selectValue = value.custom ? CUSTOM : value.cropKey ?? '';
  const definition = value.cropKey ? cropByKey(value.cropKey) : undefined;
  const issue = cropRuleIssue({
    cropKey: value.cropKey,
    environment: value.environment,
    fertilizer: value.fertilizer,
  });

  function chooseCrop(next: string) {
    if (next === CUSTOM) onChange({ ...value, custom: true, cropKey: null });
    else if (next === '') onChange({ ...value, custom: false, cropKey: null, cropName: '' });
    else onChange({ ...value, custom: false, cropKey: next, cropName: '' });
  }

  return (
    <>
      <label>
        作物
        <select data-field="crop" value={selectValue} onChange={(event) => chooseCrop(event.target.value)}>
          <option value="">未选择作物</option>
          <optgroup label="支持范围（普通室外、无肥料）">
            {supported.map((crop) => (
              <option key={crop.key} value={crop.key}>
                {crop.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="特殊条件（规则未验证）">
            {special.map((crop) => (
              <option key={crop.key} value={crop.key}>
                {crop.name}（{CROP_CONDITION_LABELS[crop.condition]}）
              </option>
            ))}
            <option value={CUSTOM}>自定义作物…</option>
          </optgroup>
        </select>
      </label>

      {value.custom ? (
        <label>
          自定义作物名称
          <input
            type="text"
            data-field="crop-name"
            value={value.cropName}
            placeholder="例如：魔法豆"
            onChange={(event) => onChange({ ...value, cropName: event.target.value })}
          />
        </label>
      ) : null}

      <label>
        株数
        <input
          type="number"
          data-field="plant-count"
          min={1}
          step={1}
          value={value.plantCount}
          onChange={(event) => {
            const next = event.target.valueAsNumber;
            if (!Number.isNaN(next)) onChange({ ...value, plantCount: next });
          }}
        />
      </label>

      <label>
        种植环境
        <select
          data-field="crop-environment"
          value={value.environment}
          onChange={(event) =>
            onChange({ ...value, environment: event.target.value as CropEnvironment })
          }
        >
          {(Object.keys(CROP_ENVIRONMENT_LABELS) as CropEnvironment[]).map((key) => (
            <option key={key} value={key}>
              {CROP_ENVIRONMENT_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      <label>
        肥料
        <select
          data-field="crop-fertilizer"
          value={value.fertilizer}
          onChange={(event) =>
            onChange({ ...value, fertilizer: event.target.value as CropFertilizer })
          }
        >
          {(Object.keys(CROP_FERTILIZER_LABELS) as CropFertilizer[]).map((key) => (
            <option key={key} value={key}>
              {CROP_FERTILIZER_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      {definition && definition.seasons.length ? (
        <p className="hint">
          数据记录的种植季节：{definition.seasons.map((season) => SEASON_NAMES[season]).join('、')}
          ；只作参考，不足以推出跨季存活。
        </p>
      ) : null}
      {issue ? (
        <p className="hint warn" data-testid="crop-rule-issue">
          {issue}
        </p>
      ) : definition && definition.growthDays !== null ? (
        <p className="hint">
          预计首次生长 {definition.growthDays} 天；每个已供水日推进一天，未供水日不推进。
        </p>
      ) : null}
    </>
  );
}
