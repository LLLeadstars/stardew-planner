import type {
  Activity,
  GameDate,
  GameMode,
  PlayerStateCommand,
  PlayerStates,
  ToolLevel,
} from '../core';
import {
  COMMUNITY_CENTER_OPTIONS,
  DAY_END,
  DAY_START,
  GAME_MODE_LABELS,
  SPECIAL_DAY_OPTIONS,
  TOOL_LEVEL_OPTIONS,
  TOOL_OPTIONS,
  TOWN_KEY_OPTIONS,
  WEATHER_OPTIONS,
  formatDate,
  formatTime,
  requiredStateRows,
} from '../core';

type Props = {
  currentDay: GameDate;
  mode: GameMode;
  activities: Activity[];
  playerStates: PlayerStates;
  activityCount: number;
  gapCount: number;
  overrunCount: number;
  collapsed: boolean;
  onToggle: () => void;
  onSetState: (command: PlayerStateCommand) => void;
};

/**
 * 左信息栏只回答两个问题：
 * 「今天的前提是什么」与「哪些玩家状态正在影响今天的判断」。
 * 未被本日活动依赖的状态不出现在这里；状态在活动首次需要时才被收集。
 */
export function LeftPanel({
  currentDay,
  mode,
  activities,
  playerStates,
  activityCount,
  gapCount,
  overrunCount,
  collapsed,
  onToggle,
  onSetState,
}: Props) {
  if (collapsed) {
    return (
      <aside className="left collapsed">
        <button type="button" className="ghost" title="展开信息栏" onClick={onToggle}>
          ›
        </button>
      </aside>
    );
  }

  const stateRows = requiredStateRows(activities, playerStates);

  return (
    <aside className="left">
      <div className="left-head">
        <h2>今天的前提</h2>
        <button type="button" className="ghost" title="收起信息栏" onClick={onToggle}>
          ‹
        </button>
      </div>
      <dl className="kv">
        <dt>游戏日</dt>
        <dd>{formatDate(currentDay)}</dd>
        <dt>模式</dt>
        <dd>{GAME_MODE_LABELS[mode]}</dd>
        <dt>区间</dt>
        <dd>
          {formatTime(DAY_START)} – {formatTime(DAY_END)}
        </dd>
      </dl>
      <PremiseSelect
        name="weather"
        label="天气"
        options={WEATHER_OPTIONS}
        value={playerStates.weather}
        onChange={(value) => onSetState({ kind: 'setWeather', value })}
      />
      <PremiseSelect
        name="specialDay"
        label="特殊日"
        options={SPECIAL_DAY_OPTIONS}
        value={playerStates.specialDay}
        onChange={(value) => onSetState({ kind: 'setSpecialDay', value })}
      />

      <h2>影响本日的玩家状态</h2>
      {stateRows.length === 0 ? (
        <p className="hint">本日的活动不依赖任何玩家状态。</p>
      ) : (
        stateRows.map((row) => (
          <div className="state-row" key={row.key} data-state={row.key}>
            {row.key === 'toolLevels' ? (
              <div className="tool-levels">
                <span className="state-name">{row.label}</span>
                <div className="tool-grid">
                  {TOOL_OPTIONS.map((tool) => (
                    <label key={tool.value} className="tool-level">
                      {tool.label}
                      <select
                        data-tool={tool.value}
                        value={playerStates.toolLevels?.[tool.value] ?? ''}
                        onChange={(event) =>
                          onSetState({
                            kind: 'setToolLevel',
                            tool: tool.value,
                            level: (event.target.value || undefined) as ToolLevel | undefined,
                          })
                        }
                      >
                        <option value="">未填写</option>
                        {TOOL_LEVEL_OPTIONS.map((level) => (
                          <option key={level.value} value={level.value}>
                            {level.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ) : row.key === 'communityCenter' ? (
              <PremiseSelect
                name="communityCenter"
                label={row.label}
                options={COMMUNITY_CENTER_OPTIONS}
                value={playerStates.communityCenter}
                onChange={(value) => onSetState({ kind: 'setCommunityCenter', value })}
              />
            ) : (
              <PremiseSelect
                name="townKey"
                label={row.label}
                options={TOWN_KEY_OPTIONS}
                value={playerStates.townKey}
                onChange={(value) => onSetState({ kind: 'setTownKey', value })}
              />
            )}
            <p className="hint">{row.impact}</p>
          </div>
        ))
      )}

      <h2>今日检查</h2>
      <ul className="checklist">
        <li>{activityCount} 项活动</li>
        <li>{gapCount} 段空闲</li>
        <li className={overrunCount ? 'warn' : ''}>
          {overrunCount ? `${overrunCount} 项超出游戏日` : '没有超出游戏日'}
        </li>
      </ul>
    </aside>
  );
}

/** 单值状态/前提的下拉；空值表示「未填写」，相关判断保持未知。 */
function PremiseSelect<T extends string>({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
}) {
  return (
    <label>
      {label}
      <select
        data-field={name}
        value={value ?? ''}
        onChange={(event) => onChange((event.target.value || undefined) as T | undefined)}
      >
        <option value="">未填写</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
