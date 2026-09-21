import { useEffect, useState } from 'react';
import type {
  Activity,
  ActivityPatch,
  ActivityType,
  GameDate,
  PlayerStateCommand,
  PlayerStateKey,
  PlayerStates,
  ReservePreferences,
  ShopJudgement,
  ShopKey,
  ShoppingItem,
} from '../core';
import {
  ACTIVITY_TYPE_LABELS,
  COMMUNITY_CENTER_OPTIONS,
  DAY_START,
  LAST_START,
  MINUTE_STEP,
  ROBIN_WORKING_OPTIONS,
  SHOP_OPTIONS,
  STATE_LABELS,
  TOWN_KEY_OPTIONS,
  activityStateKeys,
  formatDuration,
  formatTime,
  judgeShop,
  parseChecklist,
  systemReserve,
} from '../core';
import { ShopAvailabilityList } from './ShopAvailability';
import { ShoppingListEditor } from './ShoppingListEditor';

type Props = {
  activity: Activity | null;
  currentDay: GameDate;
  playerStates: PlayerStates;
  preferences: ReservePreferences;
  onPatch: (patch: ActivityPatch) => void;
  onSaveDefault: (activityType: ActivityType, minutes: number) => void;
  onDelete: () => void;
  onToggleCompleted?: (completed: boolean) => void;
  onSetState: (command: PlayerStateCommand) => void;
};

function startOptions(): number[] {
  const options: number[] = [];
  for (let value = DAY_START; value <= LAST_START; value += MINUTE_STEP) options.push(value);
  return options;
}

const START_OPTIONS = startOptions();

export function Inspector({
  activity,
  currentDay,
  playerStates,
  preferences,
  onPatch,
  onSaveDefault,
  onDelete,
  onToggleCompleted = () => {},
  onSetState,
}: Props) {
  if (!activity) {
    return (
      <aside className="inspector">
        <div className="empty">点任意卡片编辑；在顶栏添加新活动。</div>
      </aside>
    );
  }

  const personal = preferences.personal[activity.activityType];
  const last = preferences.last[activity.activityType];
  const details = activity.details ?? {};
  const isTravel = activity.activityType === 'travel';
  const isSpot = activity.activityType === 'fishing' || activity.activityType === 'mining';
  const isShop = activity.activityType === 'shop';
  const shoppingList = details.shoppingList ?? [];
  const conditionKeys = isShop ? activityStateKeys(activity) : [];
  const judgement: ShopJudgement | null =
    isShop && details.shop ? judgeShop(details.shop, currentDay, playerStates) : null;

  function patchDetails(key: 'from' | 'to' | 'place' | 'target', value: string) {
    onPatch({ details: { ...details, [key]: value } });
  }

  function patchShoppingList(next: ShoppingItem[]) {
    onPatch({ details: { ...details, shoppingList: next } });
  }

  return (
    <aside className="inspector">
      <h2>检查器</h2>
      <p className="hint">类型：{ACTIVITY_TYPE_LABELS[activity.activityType]}</p>
      <label>
        名称
        <input
          type="text"
          data-field="name"
          value={activity.name}
          onChange={(event) => onPatch({ name: event.target.value })}
        />
      </label>
      <label>
        开始时刻
        <select value={activity.start} onChange={(event) => onPatch({ start: Number(event.target.value) })}>
          {START_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {formatTime(value)}
            </option>
          ))}
        </select>
      </label>
      <DurationField value={activity.duration} onCommit={(duration) => onPatch({ duration })} />

      {isShop ? (
        <ShopInspector
          shop={details.shop}
          judgement={judgement}
          playerStates={playerStates}
          conditionKeys={conditionKeys}
          shoppingList={shoppingList}
          onSelectShop={(shop) => onPatch({ details: { ...details, shop } })}
          onChangeShoppingList={patchShoppingList}
          onSetState={onSetState}
        />
      ) : null}

      {isTravel ? (
        <>
          <label>
            起点（可选）
            <input
              type="text"
              data-field="from"
              value={details.from ?? ''}
              placeholder="例如：农场"
              onChange={(event) => patchDetails('from', event.target.value)}
            />
          </label>
          <label>
            终点（可选）
            <input
              type="text"
              data-field="to"
              value={details.to ?? ''}
              placeholder="例如：铁匠铺"
              onChange={(event) => patchDetails('to', event.target.value)}
            />
          </label>
          <p className="hint">工具不估算路线；时长由玩家填写。</p>
        </>
      ) : null}

      {isSpot ? (
        <>
          <label>
            地点（可选）
            <input
              type="text"
              data-field="place"
              value={details.place ?? ''}
              onChange={(event) => patchDetails('place', event.target.value)}
            />
          </label>
          <label>
            目标（自由文本）
            <input
              type="text"
              data-field="target"
              value={details.target ?? ''}
              onChange={(event) => patchDetails('target', event.target.value)}
            />
          </label>
          <p className="hint">V1 不估算产出或达成目标的时间。</p>
        </>
      ) : null}

      <label>
        备注
        <textarea
          data-field="note"
          rows={2}
          value={activity.note ?? ''}
          onChange={(event) => onPatch({ note: event.target.value })}
        />
      </label>
      {isShop ? null : (
        <label>
          清单（每行一项）
          <textarea
            data-field="checklist"
            rows={3}
            value={(activity.checklist ?? []).join('\n')}
            onChange={(event) => onPatch({ checklist: parseChecklist(event.target.value) })}
          />
        </label>
      )}

      <label className="check-row">
        <input type="checkbox" checked={activity.protection.completed} onChange={(event) => onToggleCompleted(event.target.checked)} />
        已完成
      </label>
      <p className="hint">
        时长解析：当前手填值 ＞ 个人默认
        {personal === undefined ? '（未设置）' : ` ${formatDuration(personal)}`} ＞ 最近一次预留
        {last === undefined ? '（无）' : ` ${formatDuration(last)}`} ＞ 系统推荐预留{' '}
        {formatDuration(systemReserve(activity.activityType))}
      </p>
      <button
        type="button"
        className="ghost"
        onClick={() => onSaveDefault(activity.activityType, activity.duration)}
      >
        保存为个人默认
      </button>
      <p className="hint">单次手填不会改变个人默认；只有点击上方按钮才会。所有改动即时写入本地存储。</p>
      <button type="button" className="danger" onClick={onDelete}>
        删除活动
      </button>
    </aside>
  );
}

/**
 * 时长输入：编辑期间保留草稿，失焦或回车才提交。
 * 直接双向绑定会被 reducer 的粒度取整打断输入（例如输入 150 时被逐位夹成 10）。
 */
function DurationField({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed > 0) {
      onCommit(parsed);
    } else {
      setDraft(String(value));
    }
  }

  return (
    <label>
      预计时长
      <input
        type="number"
        data-field="duration"
        min={MINUTE_STEP}
        step={MINUTE_STEP}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
      />
    </label>
  );
}

/** 购物活动的检查器区块：门店、两个独立结论、就地补状态、规则详情与购物清单。 */
function ShopInspector({
  shop,
  judgement,
  playerStates,
  conditionKeys,
  shoppingList,
  onSelectShop,
  onChangeShoppingList,
  onSetState,
}: {
  shop?: ShopKey;
  judgement: ShopJudgement | null;
  playerStates: PlayerStates;
  conditionKeys: PlayerStateKey[];
  shoppingList: ShoppingItem[];
  onSelectShop: (shop: ShopKey | undefined) => void;
  onChangeShoppingList: (next: ShoppingItem[]) => void;
  onSetState: (command: PlayerStateCommand) => void;
}) {
  return (
    <>
      <label>
        门店
        <select
          data-field="shop"
          value={shop ?? ''}
          onChange={(event) =>
            onSelectShop((event.target.value || undefined) as ShopKey | undefined)
          }
        >
          <option value="">未选择</option>
          {SHOP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {judgement ? (
        <div className="shop-panel">
          <ShopAvailabilityList judgement={judgement} />
        </div>
      ) : (
        <p className="hint">选择门店后显示「建筑可进入」与「服务可交易」两个独立结论。</p>
      )}

      {judgement && conditionKeys.length ? (
        <div className="shop-conditions">
          <span className="state-name">判断条件（可就地补充后复核）</span>
          {conditionKeys.map((key) => (
            <ConditionSelect
              key={key}
              stateKey={key}
              playerStates={playerStates}
              onSetState={onSetState}
            />
          ))}
        </div>
      ) : null}

      {judgement ? (
        <details className="rule-details" data-testid="shop-rule-details">
          <summary>规则详情</summary>
          {judgement.rules.map((rule) => (
            <div className="rule" key={rule.ruleId}>
              <p>
                <strong>{rule.version}</strong> · {rule.platform}
              </p>
              <p>判断条件：{rule.conditions.join('、')}</p>
              <p>来源：{rule.source}</p>
              <p>核验日期：{rule.verifiedAt}</p>
              <p>可信度：{rule.confidence}</p>
              <p>待验证：{rule.pending.join('；')}</p>
            </div>
          ))}
        </details>
      ) : null}

      <ShoppingListEditor items={shoppingList} onChange={onChangeShoppingList} />
    </>
  );
}

/** 判断条件的就地修正：只处理购物活动依赖的状态，天气与特殊日仍由左栏前提区负责。 */
function ConditionSelect({
  stateKey,
  playerStates,
  onSetState,
}: {
  stateKey: PlayerStateKey;
  playerStates: PlayerStates;
  onSetState: (command: PlayerStateCommand) => void;
}) {
  if (stateKey === 'communityCenter') {
    return (
      <label>
        {STATE_LABELS.communityCenter}
        <select
          data-field="state-communityCenter"
          value={playerStates.communityCenter ?? ''}
          onChange={(event) =>
            onSetState({
              kind: 'setCommunityCenter',
              value: (event.target.value || undefined) as PlayerStates['communityCenter'],
            })
          }
        >
          <option value="">未填写</option>
          {COMMUNITY_CENTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (stateKey === 'townKey') {
    return (
      <label>
        {STATE_LABELS.townKey}
        <select
          data-field="state-townKey"
          value={playerStates.townKey ?? ''}
          onChange={(event) =>
            onSetState({
              kind: 'setTownKey',
              value: (event.target.value || undefined) as PlayerStates['townKey'],
            })
          }
        >
          <option value="">未填写</option>
          {TOWN_KEY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (stateKey === 'robinWorking') {
    return (
      <label>
        {STATE_LABELS.robinWorking}
        <select
          data-field="state-robinWorking"
          value={playerStates.robinWorking ?? ''}
          onChange={(event) =>
            onSetState({
              kind: 'setRobinWorking',
              value: (event.target.value || undefined) as PlayerStates['robinWorking'],
            })
          }
        >
          <option value="">未填写</option>
          {ROBIN_WORKING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return null;
}
