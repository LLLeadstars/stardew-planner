import { useEffect, useState } from 'react';
import type {
  Activity,
  ActivityPatch,
  ActivityType,
  CropBatch,
  CropGrowth,
  GameDate,
  NewCropBatchFields,
  PendingToolUpgrade,
  PlayerStateCommand,
  PlayerStateKey,
  PlayerStates,
  ReservePreferences,
  ShopJudgement,
  ShopKey,
  ShoppingItem,
  ToolKey,
  ToolLevel,
  ToolUpgradeCheck,
} from '../core';
import {
  ACTIVITY_TYPE_LABELS,
  COMMUNITY_CENTER_OPTIONS,
  DAY_START,
  LAST_START,
  MINUTE_STEP,
  PICKUP_BAG_SLOT_REMINDER,
  ROBIN_WORKING_OPTIONS,
  SHOP_OPTIONS,
  STATE_LABELS,
  TOOL_LEVEL_OPTIONS,
  TOOL_OPTIONS,
  TOOL_UPGRADE_PHASE_LABELS,
  TOWN_KEY_OPTIONS,
  activityStateKeys,
  canDeliverTool,
  canPickupTool,
  cropGrowth,
  earliestPickupDate,
  formatDate,
  formatDuration,
  formatTime,
  identityKey,
  judgeShop,
  parseChecklist,
  systemReserve,
  toolLabel,
  toolUpgradeOffer,
  toolUpgradePhase,
} from '../core';
import { CropBatchFields, cropFieldsFromBatch, cropFieldsToBatchFields } from './CropBatchFields';
import { ShopAvailabilityList } from './ShopAvailability';
import { ShoppingListEditor } from './ShoppingListEditor';

type Props = {
  activity: Activity | null;
  currentDay: GameDate;
  playerStates: PlayerStates;
  preferences: ReservePreferences;
  /** 当前正在升级或待取回的工具；后台等待，不占用日程时间。 */
  toolUpgrade: PendingToolUpgrade | null;
  /** 当前日程里的全部作物批次；种植活动只展示与其身份关联的部分。 */
  cropBatches: CropBatch[];
  onPatch: (patch: ActivityPatch) => void;
  onSaveDefault: (activityType: ActivityType, minutes: number) => void;
  onDelete: () => void;
  onToggleCompleted?: (completed: boolean) => void;
  onUpdateBatch: (batchId: string, patch: Partial<NewCropBatchFields>) => void;
  onRecordSupply: (batchId: string, wateredCount: number) => void;
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
  toolUpgrade,
  cropBatches,
  onPatch,
  onSaveDefault,
  onDelete,
  onToggleCompleted = () => {},
  onUpdateBatch,
  onRecordSupply,
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
  const isToolGive = activity.activityType === 'toolGive';
  const isToolTake = activity.activityType === 'toolTake';
  const isPlant = activity.activityType === 'plant';
  const plantBatches = isPlant
    ? cropBatches.filter(
        (batch) => batch.sourceKey === identityKey(activity.identity),
      )
    : [];
  const shoppingList = details.shoppingList ?? [];
  const conditionKeys = isShop ? activityStateKeys(activity) : [];
  const judgement: ShopJudgement | null =
    isShop && details.shop ? judgeShop(details.shop, currentDay, playerStates) : null;
  const tool = details.tool;
  const currentToolLevel = tool ? playerStates.toolLevels?.[tool] : undefined;
  let toolCheck: ToolUpgradeCheck | null = null;
  if (isToolGive || isToolTake) {
    if (!tool) {
      toolCheck = { ok: false, reason: `先选择要${isToolGive ? '交付' : '取回'}的工具。` };
    } else if (isToolGive) {
      toolCheck = canDeliverTool(toolUpgrade, tool, currentToolLevel);
    } else {
      toolCheck = canPickupTool(toolUpgrade, tool, currentDay, playerStates);
    }
  }
  const toolBlocked = toolCheck !== null && !toolCheck.ok && !activity.protection.completed;
  const blacksmithJudgement = isToolGive || isToolTake
    ? judgeShop('blacksmith', currentDay, playerStates)
    : null;

  function patchDetails(key: 'from' | 'to' | 'place' | 'target', value: string) {
    onPatch({ details: { ...details, [key]: value } });
  }

  function patchShoppingList(next: ShoppingItem[]) {
    onPatch({ details: { ...details, shoppingList: next } });
  }

  function selectTool(next: ToolKey | undefined) {
    onPatch({ details: { ...details, tool: next } });
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

      {isPlant ? (
        <PlantInspector
          batches={plantBatches}
          currentDay={currentDay}
          onUpdateBatch={onUpdateBatch}
          onRecordSupply={onRecordSupply}
        />
      ) : null}

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

      {isToolGive ? (
        <ToolGiveInspector
          tool={tool}
          currentLevel={currentToolLevel}
          currentDay={currentDay}
          playerStates={playerStates}
          toolUpgrade={toolUpgrade}
          judgement={blacksmithJudgement}
          onSelectTool={selectTool}
          onSetState={onSetState}
        />
      ) : null}

      {isToolTake ? (
        <ToolTakeInspector
          tool={tool}
          toolUpgrade={toolUpgrade}
          currentDay={currentDay}
          playerStates={playerStates}
          judgement={blacksmithJudgement}
          onSelectTool={selectTool}
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
        <input
          type="checkbox"
          checked={activity.protection.completed}
          disabled={toolBlocked}
          onChange={(event) => onToggleCompleted(event.target.checked)}
        />
        已完成
      </label>
      {toolBlocked && toolCheck && !toolCheck.ok ? (
        <p className="hint warn" data-testid="tool-block-reason">
          {toolCheck.reason}
        </p>
      ) : null}
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

/** 种植活动的作物批次区块：条件可编辑，已种植批次可记录今日供水。 */
function PlantInspector({
  batches,
  currentDay,
  onUpdateBatch,
  onRecordSupply,
}: {
  batches: CropBatch[];
  currentDay: GameDate;
  onUpdateBatch: (batchId: string, patch: Partial<NewCropBatchFields>) => void;
  onRecordSupply: (batchId: string, wateredCount: number) => void;
}) {
  if (!batches.length) {
    return (
      <p className="hint">
        该种植活动还没有作物批次；新建时选择作物即可建立计划批次，实际完成后再开始生长推进。
      </p>
    );
  }
  return (
    <div className="crop-batches">
      {batches.map((batch) => (
        <CropBatchCard
          key={batch.id}
          batch={batch}
          currentDay={currentDay}
          onUpdateBatch={onUpdateBatch}
          onRecordSupply={onRecordSupply}
        />
      ))}
    </div>
  );
}

function cropGrowthText(growth: CropGrowth): string {
  if (growth.status === 'planned') return '计划中：完成种植后开始生长推进。';
  if (growth.status === 'unverified') return growth.reason;
  const parts = [`首次预计收获：${formatDate(growth.firstHarvest)}`];
  parts.push(`生长 ${growth.wateredDays}/${growth.growthDays} 天`);
  if (growth.stalledDays) parts.push(`已按漏浇顺延 ${growth.stalledDays} 天`);
  if (growth.conditional) parts.push('条件性预计：部分日期尚无供水记录');
  return parts.join('；');
}

function CropBatchCard({
  batch,
  currentDay,
  onUpdateBatch,
  onRecordSupply,
}: {
  batch: CropBatch;
  currentDay: GameDate;
  onUpdateBatch: (batchId: string, patch: Partial<NewCropBatchFields>) => void;
  onRecordSupply: (batchId: string, wateredCount: number) => void;
}) {
  const growth = cropGrowth(batch, currentDay);
  const [supplyCount, setSupplyCount] = useState(batch.plantCount);

  useEffect(() => {
    setSupplyCount(batch.plantCount);
  }, [batch.plantCount]);

  return (
    <div className="crop-batch" data-testid="crop-batch" data-batch-id={batch.id}>
      <div className="crop-batch-head">
        <strong data-testid="crop-batch-name">{batch.cropName}</strong>
        <span className="crop-status" data-status={batch.status}>
          {batch.status === 'planted' ? '已种植' : '计划中'}
        </span>
      </div>
      <CropBatchFields
        value={cropFieldsFromBatch(batch)}
        onChange={(next) => onUpdateBatch(batch.id, cropFieldsToBatchFields(next))}
      />
      <p className="hint" data-testid="crop-growth">
        {cropGrowthText(growth)}
      </p>
      {batch.status === 'planted' ? (
        <div className="supply-row">
          <label>
            今日供水株数
            <input
              type="number"
              data-field="supply-count"
              min={0}
              step={1}
              value={supplyCount}
              onChange={(event) => {
                const next = event.target.valueAsNumber;
                if (!Number.isNaN(next)) setSupplyCount(next);
              }}
            />
          </label>
          <button
            type="button"
            className="ghost"
            data-action="record-supply"
            onClick={() => onRecordSupply(batch.id, supplyCount)}
          >
            记录今日供水
          </button>
        </div>
      ) : null}
    </div>
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

function toolLevelLabel(level: ToolLevel): string {
  return TOOL_LEVEL_OPTIONS.find((option) => option.value === level)?.label ?? level;
}

/** 工具升级交付与取回共用的工具选择。 */
function ToolSelect({
  value,
  onSelect,
}: {
  value?: ToolKey;
  onSelect: (tool: ToolKey | undefined) => void;
}) {
  return (
    <label>
      工具
      <select
        data-field="tool"
        value={value ?? ''}
        onChange={(event) => onSelect((event.target.value || undefined) as ToolKey | undefined)}
      >
        <option value="">未选择</option>
        {TOOL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 工具升级交付：工具、当前等级、目标等级、材料、费用与铁匠铺柜台条件。 */
function ToolGiveInspector({
  tool,
  currentLevel,
  currentDay,
  playerStates,
  toolUpgrade,
  judgement,
  onSelectTool,
  onSetState,
}: {
  tool?: ToolKey;
  currentLevel?: ToolLevel;
  currentDay: GameDate;
  playerStates: PlayerStates;
  toolUpgrade: PendingToolUpgrade | null;
  judgement: ShopJudgement | null;
  onSelectTool: (tool: ToolKey | undefined) => void;
  onSetState: (command: PlayerStateCommand) => void;
}) {
  const offer = tool && currentLevel ? toolUpgradeOffer(tool, currentLevel) : null;
  return (
    <>
      <ToolSelect value={tool} onSelect={onSelectTool} />

      {tool ? (
        <label>
          当前等级
          <select
            data-field="state-tool-level"
            value={currentLevel ?? ''}
            onChange={(event) =>
              onSetState({
                kind: 'setToolLevel',
                tool,
                level: (event.target.value || undefined) as ToolLevel | undefined,
              })
            }
          >
            <option value="">未填写</option>
            {TOOL_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {offer ? (
        <div className="tool-upgrade-panel" data-testid="tool-upgrade-offer">
          <span>目标等级：{toolLevelLabel(offer.targetLevel)}</span>
          <span>材料：{offer.materials.map((item) => `${item.name} ×${item.count}`).join('、')}</span>
          <span>费用：{offer.cost.toLocaleString()}g</span>
        </div>
      ) : tool && currentLevel ? (
        <p className="hint">{toolLabel(tool)}已经是最高等级，没有可升级的目标。</p>
      ) : tool ? (
        <p className="hint">填写当前等级后显示目标等级、材料与费用。</p>
      ) : null}

      {toolUpgrade ? (
        <p className="hint warn" data-testid="tool-in-progress">
          {toolLabel(toolUpgrade.tool)}正在升级流程中（
          {TOOL_UPGRADE_PHASE_LABELS[toolUpgradePhase(toolUpgrade, currentDay)]}，完成日
          {formatDate(toolUpgrade.completesOn)}，最早可取回
          {formatDate(earliestPickupDate(toolUpgrade.completesOn, playerStates))}）；同一时间只能升级一件工具。
        </p>
      ) : null}

      {judgement ? (
        <div className="shop-panel">
          <span className="state-name">柜台条件（铁匠铺）</span>
          <ShopAvailabilityList judgement={judgement} />
        </div>
      ) : null}
      <p className="hint">计划交付本身不改变工具状态；标记完成后才进入升级中。</p>
    </>
  );
}

/** 工具取回：关联升级中的工具，显示完成日、最早取回日与背包空位提醒。 */
function ToolTakeInspector({
  tool,
  toolUpgrade,
  currentDay,
  playerStates,
  judgement,
  onSelectTool,
}: {
  tool?: ToolKey;
  toolUpgrade: PendingToolUpgrade | null;
  currentDay: GameDate;
  playerStates: PlayerStates;
  judgement: ShopJudgement | null;
  onSelectTool: (tool: ToolKey | undefined) => void;
}) {
  const matchingUpgrade = tool && toolUpgrade && toolUpgrade.tool === tool ? toolUpgrade : null;
  return (
    <>
      <ToolSelect value={tool} onSelect={onSelectTool} />

      {matchingUpgrade ? (
        <div className="tool-upgrade-panel" data-testid="tool-upgrade-status">
          <span>目标等级：{toolLevelLabel(matchingUpgrade.targetLevel)}</span>
          <span>状态：{TOOL_UPGRADE_PHASE_LABELS[toolUpgradePhase(matchingUpgrade, currentDay)]}</span>
          <span>完成日：{formatDate(matchingUpgrade.completesOn)}（交付日 +2 天，节日不顺延）</span>
          <span>最早可取回：{formatDate(earliestPickupDate(matchingUpgrade.completesOn, playerStates))}</span>
        </div>
      ) : toolUpgrade ? (
        <p className="hint">升级中的是{toolLabel(toolUpgrade.tool)}，请选择对应工具后取回。</p>
      ) : (
        <p className="hint">当前没有升级中的工具可供取回。</p>
      )}

      <p className="hint" data-testid="tool-bag-reminder">
        {PICKUP_BAG_SLOT_REMINDER}
      </p>
      <p className="hint">完成取回后才更新工具等级；此前工具不在手中。</p>

      {judgement ? (
        <div className="shop-panel">
          <span className="state-name">柜台条件（铁匠铺）</span>
          <ShopAvailabilityList judgement={judgement} />
        </div>
      ) : null}
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
