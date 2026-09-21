import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
  formatDuration,
  systemReserve,
} from '../core';
import type { ActivityType } from '../core';

type Props = {
  onSelect: (activityType: ActivityType) => void;
  onCancel: () => void;
};

/** 每种内置活动的一句话说明：它做什么、不做什么。 */
const BLURBS: Record<ActivityType, string> = {
  plant: '可随活动建立计划作物批次，实际完成后再开始生长',
  water: 'V1 按时间预留，不依赖尚未校准的工作量系数',
  harvest: '按时间预留，可关联作物批次',
  shop: '可选门店并记录购物清单',
  toolGive: '标记完成后工具才进入「升级中」',
  toolTake: '完成取回后才更新工具等级',
  travel: '可选起点与终点，时长由你填写',
  fishing: '可选地点与自由文本目标',
  mining: '可选地点与自由文本目标',
  custom: '自由填写事项与预计时长',
};

/**
 * 类型弹层：从顶栏「＋ 添加」进入的唯一添加入口。
 * 这里只负责选类型；每种类型的少量参数在下一步的活动弹层里填写。
 */
export function ActivityTypePicker({ onSelect, onCancel }: Props) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal type-picker" onClick={(event) => event.stopPropagation()}>
        <h2>添加活动</h2>
        <p className="hint">选一个活动类型；内置活动只需最少参数即可保存。</p>
        <div className="type-grid">
          {ACTIVITY_TYPES.map((activityType) => (
            <button
              key={activityType}
              type="button"
              className="type-option"
              data-testid="activity-type-option"
              data-activity-type={activityType}
              onClick={() => onSelect(activityType)}
            >
              <span className="type-name">{ACTIVITY_TYPE_LABELS[activityType]}</span>
              <span className="hint">{BLURBS[activityType]}</span>
              <span className="type-reserve">
                系统推荐预留 {formatDuration(systemReserve(activityType))} · 可编辑的规划起点
              </span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
