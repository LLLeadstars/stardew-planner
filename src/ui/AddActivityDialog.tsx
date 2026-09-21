import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  MINUTE_STEP,
  SHOP_OPTIONS,
  activityTypeLabel,
  formatDuration,
  parseChecklist,
  resolveReserve,
} from '../core';
import type {
  ActivityDetails,
  ActivityType,
  DurationSource,
  ReservePreferences,
  ShopKey,
  ShoppingItem,
} from '../core';
import { ShoppingListEditor } from './ShoppingListEditor';

/** 添加弹层交给应用层的当次内容；时长缺省表示让 reducer 走解析链。 */
export type ActivityDraft = {
  name: string;
  duration?: number;
  note?: string;
  checklist?: string[];
  details?: ActivityDetails;
};

type Props = {
  activityType: ActivityType;
  preferences: ReservePreferences;
  onCancel: () => void;
  onSubmit: (draft: ActivityDraft) => void;
};

const SOURCE_LABELS: Record<DurationSource, string> = {
  manual: '当前手填值',
  personal: '个人默认',
  last: '最近一次预留',
  system: '系统推荐预留',
};

export function AddActivityDialog({ activityType, preferences, onCancel, onSubmit }: Props) {
  const prefill = useMemo(
    () => resolveReserve({ activityType, preferences }),
    [activityType, preferences],
  );
  const label = activityTypeLabel(activityType);
  const isTravel = activityType === 'travel';
  const isSpot = activityType === 'fishing' || activityType === 'mining';
  const isShop = activityType === 'shop';

  const [name, setName] = useState('');
  const [duration, setDuration] = useState(prefill.minutes);
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState('');
  const [checklist, setChecklist] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [place, setPlace] = useState('');
  const [target, setTarget] = useState('');
  const [shop, setShop] = useState<ShopKey | ''>('');
  const [shoppingRows, setShoppingRows] = useState<ShoppingItem[]>([{ name: '', quantity: '' }]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const items = parseChecklist(checklist);
    // 未改动时长时让 reducer 走解析链；改动过才作为「当前活动手填值」提交。
    onSubmit({
      name: name.trim() || label,
      duration: touched ? duration : undefined,
      note: note.trim() || undefined,
      checklist: items.length ? items : undefined,
      details: buildDetails(),
    });
  }

  function buildDetails(): ActivityDetails | undefined {
    if (isShop) return buildShopDetails();
    if (isTravel) return compact({ from, to });
    if (isSpot) return compact({ place, target });
    return undefined;
  }

  /** 购物清单项只保存玩家填写的名称与数量，不校验价格、库存或购买条件。 */
  function buildShopDetails(): ActivityDetails | undefined {
    const details: ActivityDetails = {};
    if (shop) details.shop = shop;
    const shoppingList: ShoppingItem[] = shoppingRows
      .map((row) => ({ name: row.name.trim(), quantity: row.quantity?.trim() ?? '' }))
      .filter((row) => row.name.length > 0)
      .map((row) => (row.quantity ? { name: row.name, quantity: row.quantity } : { name: row.name }));
    if (shoppingList.length) details.shoppingList = shoppingList;
    return Object.keys(details).length ? details : undefined;
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>添加{label}</h2>
        <label>
          名称
          <input
            type="text"
            data-field="name"
            autoFocus
            value={name}
            placeholder={label}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          预计时长
          <input
            type="number"
            data-field="duration"
            min={MINUTE_STEP}
            step={MINUTE_STEP}
            value={duration}
            onChange={(event) => {
              const value = event.target.valueAsNumber;
              if (!Number.isNaN(value)) {
                setDuration(value);
                setTouched(true);
              }
            }}
          />
        </label>

        {isTravel ? (
          <>
            <label>
              起点（可选）
              <input
                type="text"
                data-field="from"
                value={from}
                placeholder="例如：农场"
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              终点（可选）
              <input
                type="text"
                data-field="to"
                value={to}
                placeholder="例如：铁匠铺"
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </>
        ) : null}

        {isShop ? (
          <>
            <label>
              门店
              <select
                data-field="shop"
                value={shop}
                onChange={(event) => setShop(event.target.value as ShopKey | '')}
              >
                <option value="">未选择</option>
                {SHOP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <ShoppingListEditor items={shoppingRows} onChange={setShoppingRows} />
          </>
        ) : null}

        {isSpot ? (
          <>
            <label>
              地点（可选）
              <input
                type="text"
                data-field="place"
                value={place}
                placeholder={activityType === 'fishing' ? '例如：山湖' : '例如：矿洞 40 层'}
                onChange={(event) => setPlace(event.target.value)}
              />
            </label>
            <label>
              目标（自由文本）
              <input
                type="text"
                data-field="target"
                value={target}
                placeholder={activityType === 'fishing' ? '例如：钓 5 条鲈鱼' : '例如：挖 30 铜矿'}
                onChange={(event) => setTarget(event.target.value)}
              />
            </label>
          </>
        ) : null}

        <label>
          备注（可选）
          <textarea
            data-field="note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {isShop ? null : (
          <label>
            清单（可选，每行一项）
            <textarea
              data-field="checklist"
              rows={3}
              value={checklist}
              placeholder={'例如：防风草种子 ×10\n肥料 ×2'}
              onChange={(event) => setChecklist(event.target.value)}
            />
          </label>
        )}

        <p className="hint">
          将占用 {formatDuration(duration)}，来自{touched ? SOURCE_LABELS.manual : SOURCE_LABELS[prefill.source]}
          （可编辑的规划起点，不是对活动成果的预测）。
        </p>
        {isTravel ? <p className="hint">工具不估算路线；根据地点估算移动耗时属后续范围。</p> : null}
        {isSpot ? <p className="hint">V1 不估算产出或达成目标的时间。</p> : null}
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="primary">
            添加
          </button>
        </div>
      </form>
    </div>
  );
}

function compact(fields: ActivityDetails): ActivityDetails | undefined {
  const details: ActivityDetails = {};
  for (const key of ['from', 'to', 'place', 'target'] as const) {
    const value = fields[key]?.trim();
    if (value) details[key] = value;
  }
  return Object.keys(details).length ? details : undefined;
}
