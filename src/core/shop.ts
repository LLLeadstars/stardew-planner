import type { GameDate } from './date';
import { weekdayOf } from './date';
import type { PlayerStateKey, PlayerStates } from './playerState';
import { formatTime } from './time';
import type { GameMinutes } from './time';

/** 购物活动可选的门店。 */
export type ShopKey = 'pierre' | 'carpenter' | 'blacksmith';

export const SHOP_OPTIONS = [
  { value: 'pierre', label: '皮埃尔杂货店' },
  { value: 'carpenter', label: '木匠商店' },
  { value: 'blacksmith', label: '铁匠铺' },
] as const satisfies readonly { value: ShopKey; label: string }[];

/**
 * 门店判定依赖的玩家状态。未选择门店时保守列出皮埃尔相关的两个状态。
 * 这是「门店 → 条件」的唯一来源，左栏与检查器都从这里取。
 */
export function shopConditionKeys(shop: ShopKey | undefined): PlayerStateKey[] {
  if (shop === 'carpenter') return ['robinWorking'];
  if (shop === 'blacksmith') return ['communityCenter'];
  return ['communityCenter', 'townKey'];
}

export function isShopKey(value: unknown): value is ShopKey {
  return typeof value === 'string' && SHOP_OPTIONS.some((option) => option.value === value);
}

/**
 * 门店结论的证据强度。
 * green（ok）＝确认可用，red（closed）＝确认不可用，yellow（unknown）＝证据不足、暂按不可用。
 */
export type Availability = 'available' | 'unavailable' | 'unknown';
export type AvailabilityTone = 'ok' | 'closed' | 'unknown';

export type AvailabilityVerdict = {
  state: Availability;
  tone: AvailabilityTone;
  label: string;
  /** 判断依据的一句话，说明为什么是这个结论。 */
  reason: string;
  /** 确定的常规时段；无法确定时省略。 */
  hours?: string;
};

/** 条件性交易窗口：约时刻的瞬时机会，只作非阻断技巧提示，不构成营业时段。 */
export type TradeTip = {
  ruleId: string;
  approximateTime: GameMinutes;
  text: string;
};

/** 规则详情：供玩家判断这条提醒有多可靠。 */
export type ShopRuleDetails = {
  ruleId: string;
  version: string;
  platform: string;
  conditions: string[];
  source: string;
  verifiedAt: string;
  confidence: string;
  pending: string[];
};

export type ShopJudgement = {
  shop: ShopKey;
  /** 建筑可进入：与「服务可交易」相互独立，不互相推导。 */
  access: AvailabilityVerdict;
  service: AvailabilityVerdict;
  tips: TradeTip[];
  rules: ShopRuleDetails[];
};

const VERSION = 'PC 原版 1.6.15';

const BASE_RULES: Record<ShopKey, ShopRuleDetails> = {
  pierre: {
    ruleId: 'shop.pierre',
    version: VERSION,
    platform: 'PC',
    conditions: ['游戏日期与星期', '节日', '社区中心状态', '城镇钥匙'],
    source: "Stardew Valley Wiki: Pierre's / Shop Schedules rev 194214",
    verifiedAt: '2026-09-18',
    confidence: '中等：社区资料固定修订，可复核但非第一方规格',
    pending: ['未完成 PC 1.6.15 本机实机复现', '节日例外清单仅覆盖资料列出的四个节日'],
  },
  carpenter: {
    ruleId: 'shop.carpenter',
    version: VERSION,
    platform: 'PC',
    conditions: ['游戏日期与星期', '天气', '节日', '罗宾施工状态'],
    source: "Stardew Valley Wiki: Carpenter's Shop rev 194219 / Robin rev 191769",
    verifiedAt: '2026-09-18',
    confidence: '中等：社区资料固定修订，可复核但非第一方规格',
    pending: ['未完成 PC 1.6.15 本机实机复现', '姜岛度假村随机出行尚未纳入判断'],
  },
  blacksmith: {
    ruleId: 'shop.blacksmith',
    version: VERSION,
    platform: 'PC',
    conditions: ['游戏日期与星期', '天气', '节日', '社区中心状态', '游戏年份'],
    source: 'Stardew Valley Wiki: Blacksmith rev 194247 / Clint',
    verifiedAt: '2026-09-18',
    confidence: '中等：社区资料固定修订，可复核但非第一方规格',
    pending: ['未完成 PC 1.6.15 本机实机复现', '春 16 日与沙漠节离店尚未纳入判断', '姜岛度假村随机出行尚未纳入判断'],
  },
};

const TUESDAY_TIP_RULE: ShopRuleDetails = {
  ruleId: 'shop.carpenter.tuesday-counter',
  version: VERSION,
  platform: 'PC',
  conditions: ['普通非特殊日周二', '非雨天', '罗宾未在农场施工'],
  source:
    "Stardew Valley Wiki: Robin rev 191769 / Carpenter's Shop rev 194219；官方论坛玩家复现",
  verifiedAt: '2026-09-15',
  confidence: '低至中等：社区资料与玩家经验交叉印证，无第一方规格',
  pending: [
    '9:40 与约 20:00 可交互的精确持续分钟数未知',
    '移动速度、路径阻挡与进图时机造成的漂移未知',
  ],
};

const SUMMER18_TIP_RULE: ShopRuleDetails = {
  ruleId: 'shop.carpenter.summer-18-counter',
  version: VERSION,
  platform: 'PC',
  conditions: ['夏 18 日', '罗宾诊所行程'],
  source: "Stardew Valley Wiki: Carpenter's Shop rev 194219 / Robin rev 191769",
  verifiedAt: '2026-09-15',
  confidence: '低至中等：社区资料，待实机校准',
  pending: ['约 17:50 可交互的精确持续分钟数未知'],
};

function rangeText(start: GameMinutes, end: GameMinutes): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

function available(label: string, hours: string, reason: string): AvailabilityVerdict {
  return { state: 'available', tone: 'ok', label, hours, reason };
}

function unavailable(label: string, reason: string): AvailabilityVerdict {
  return { state: 'unavailable', tone: 'closed', label, reason };
}

function unknown(label: string, reason: string): AvailabilityVerdict {
  return { state: 'unknown', tone: 'unknown', label, reason };
}

const ACCESS_LABELS = {
  available: '确认可进入',
  unavailable: '确认关闭',
  unknown: '暂按不可用',
} as const;

const SERVICE_LABELS = {
  available: '确认可交易',
  unavailable: '确认关闭',
  unknown: '暂按不可用',
} as const;

function accessAvailable(hours: string, reason: string): AvailabilityVerdict {
  return available(ACCESS_LABELS.available, hours, reason);
}
function accessUnavailable(reason: string): AvailabilityVerdict {
  return unavailable(ACCESS_LABELS.unavailable, reason);
}
function accessUnknown(reason: string): AvailabilityVerdict {
  return unknown(ACCESS_LABELS.unknown, reason);
}
function serviceAvailable(hours: string, reason: string): AvailabilityVerdict {
  return available(SERVICE_LABELS.available, hours, reason);
}
function serviceUnavailable(reason: string): AvailabilityVerdict {
  return unavailable(SERVICE_LABELS.unavailable, reason);
}
function serviceUnknown(reason: string): AvailabilityVerdict {
  return unknown(SERVICE_LABELS.unknown, reason);
}

function isFestival(states: PlayerStates): boolean {
  return states.specialDay === 'festival';
}

/**
 * 门店判定：把「建筑可进入」与「服务可交易」作为两个独立结论计算。
 * 条件不满足或事实未知时按不可用或未知处理；条件性窗口只作非阻断技巧保留。
 */
export function judgeShop(shop: ShopKey, date: GameDate, states: PlayerStates): ShopJudgement {
  switch (shop) {
    case 'pierre':
      return judgePierre(date, states);
    case 'carpenter':
      return judgeCarpenter(date, states);
    case 'blacksmith':
      return judgeBlacksmith(date, states);
  }
}

function judgePierre(date: GameDate, states: PlayerStates): ShopJudgement {
  const wednesday = weekdayOf(date) === 'wed';
  if (isFestival(states)) {
    return {
      shop: 'pierre',
      access: accessUnavailable('节日通常关闭，城镇钥匙也不生效。'),
      service: serviceUnavailable('节日通常关闭。'),
      tips: [],
      rules: [BASE_RULES.pierre],
    };
  }
  if (!wednesday) {
    return {
      shop: 'pierre',
      access: accessAvailable(rangeText(9 * 60, 21 * 60), '常规营业日，建筑 09:00–21:00 可进入。'),
      service: serviceAvailable(rangeText(9 * 60, 17 * 60), '常规营业日，皮埃尔 09:00–17:00 在柜台。'),
      tips: [],
      rules: [BASE_RULES.pierre],
    };
  }
  const wednesdayOpen = communityCenterOrKey(states);
  if (wednesdayOpen === 'yes') {
    return {
      shop: 'pierre',
      access: accessAvailable(rangeText(9 * 60, 21 * 60), '社区中心已完成或持有城镇钥匙，周三照常开放。'),
      service: serviceAvailable(rangeText(9 * 60, 17 * 60), '社区中心已完成或持有城镇钥匙，周三照常营业。'),
      tips: [],
      rules: [BASE_RULES.pierre],
    };
  }
  if (wednesdayOpen === 'no') {
    return {
      shop: 'pierre',
      access: accessUnavailable('周三通常不可进入；社区中心未完成且没有城镇钥匙。'),
      service: serviceUnavailable('周三通常休息；社区中心未完成且没有城镇钥匙。'),
      tips: [],
      rules: [BASE_RULES.pierre],
    };
  }
  return {
    shop: 'pierre',
    access: accessUnknown('社区中心状态或城镇钥匙未填写，无法判断周三是否可进入。'),
    service: serviceUnknown('社区中心状态或城镇钥匙未填写，无法判断周三是否营业。'),
    tips: [],
    rules: [BASE_RULES.pierre],
  };
}

/** 皮埃尔周三是否开放：两者任一为「是」即开放；都已知且都为「否」才关闭，否则未知。 */
function communityCenterOrKey(states: PlayerStates): 'yes' | 'no' | 'unknown' {
  if (states.communityCenter === 'restored' || states.townKey === 'yes') return 'yes';
  if (states.communityCenter === 'notRestored' && states.townKey === 'no') return 'no';
  return 'unknown';
}

function judgeCarpenter(date: GameDate, states: PlayerStates): ShopJudgement {
  const access = accessAvailable(
    rangeText(9 * 60, 20 * 60),
    '房屋通常 09:00–20:00 可进入，即使商店柜台关闭。',
  );
  if (isFestival(states)) {
    return {
      shop: 'carpenter',
      access: accessUnavailable('节日通常关闭。'),
      service: serviceUnavailable('节日通常关闭。'),
      tips: [],
      rules: [BASE_RULES.carpenter],
    };
  }
  if (states.robinWorking === 'yes') {
    return {
      shop: 'carpenter',
      access,
      service: serviceUnavailable('罗宾正在农场施工，商店全天关闭。'),
      tips: [],
      rules: [BASE_RULES.carpenter],
    };
  }

  const weekday = weekdayOf(date);
  const isTuesday = weekday === 'tue';
  const isSummer18 = date.season === 1 && date.day === 18;

  if (isSummer18) {
    return {
      shop: 'carpenter',
      access,
      service: serviceUnavailable('夏 18 日罗宾去诊所，商店关闭。'),
      tips: [tip(SUMMER18_TIP_RULE.ruleId, 17 * 60 + 50, '约 17:50 在柜台等候，罗宾经过时可尝试交易。')],
      rules: [BASE_RULES.carpenter, SUMMER18_TIP_RULE],
    };
  }

  if (isTuesday) {
    if (states.weather === 'rain') {
      return {
        shop: 'carpenter',
        access,
        service: serviceAvailable(
          rangeText(9 * 60, 17 * 60),
          '周二下雨时按雨天日程营业，09:00–17:00 柜台可用。',
        ),
        tips: [],
        rules: [BASE_RULES.carpenter],
      };
    }
    const tips = [
      tip(TUESDAY_TIP_RULE.ruleId, 9 * 60 + 40, '约 9:40 在柜台等候，罗宾经过时可尝试交易。'),
      tip(TUESDAY_TIP_RULE.ruleId, 20 * 60, '约 20:00 罗宾回家经过柜台，可尝试交易（次要机会）。'),
    ];
    if (states.weather === 'greenRain') {
      return {
        shop: 'carpenter',
        access,
        service: serviceUnknown('绿雨日程可能覆盖普通周二路线，需当天复核。'),
        tips,
        rules: [BASE_RULES.carpenter, TUESDAY_TIP_RULE],
      };
    }
    if (states.weather === 'sunny') {
      return {
        shop: 'carpenter',
        access,
        service: serviceUnavailable('今日休息：周二通常关闭，下雨才照常营业。'),
        tips,
        rules: [BASE_RULES.carpenter, TUESDAY_TIP_RULE],
      };
    }
    return {
      shop: 'carpenter',
      access,
      service: serviceUnknown('天气未填写，无法判断周二是否按雨天日程营业。'),
      tips,
      rules: [BASE_RULES.carpenter, TUESDAY_TIP_RULE],
    };
  }

  const closesAt = weekday === 'fri' ? 16 * 60 : 17 * 60;
  return {
    shop: 'carpenter',
    access,
    service: serviceAvailable(
      rangeText(9 * 60, closesAt),
      weekday === 'fri'
        ? '常规营业 09:00–17:00，周五提前到 16:00 关店。'
        : '常规营业 09:00–17:00。',
    ),
    tips: [],
    rules: [BASE_RULES.carpenter],
  };
}

function tip(ruleId: string, approximateTime: GameMinutes, text: string): TradeTip {
  return { ruleId, approximateTime, text };
}

function judgeBlacksmith(date: GameDate, states: PlayerStates): ShopJudgement {
  const access = accessAvailable(rangeText(9 * 60, 16 * 60), '建筑门 09:00–16:00 开放。');
  if (isFestival(states)) {
    return {
      shop: 'blacksmith',
      access: accessUnavailable('节日通常关闭。'),
      service: serviceUnavailable('节日通常关闭；加工倒计时仍会继续。'),
      tips: [],
      rules: [BASE_RULES.blacksmith],
    };
  }
  if (date.year === 1 && states.weather === 'greenRain') {
    return {
      shop: 'blacksmith',
      access,
      service: serviceUnavailable('第 1 年绿雨日 Clint 离店。'),
      tips: [],
      rules: [BASE_RULES.blacksmith],
    };
  }
  if (date.season === 3 && date.day === 16) {
    return {
      shop: 'blacksmith',
      access,
      service: serviceAvailable(
        rangeText(9 * 60, 10 * 60 + 30),
        '冬 16 日 Clint 10:30 离店，只有上午柜台可用。',
      ),
      tips: [],
      rules: [BASE_RULES.blacksmith],
    };
  }
  if (weekdayOf(date) === 'fri') {
    if (states.communityCenter === 'restored') {
      if (states.weather === 'rain') {
        return {
          shop: 'blacksmith',
          access,
          service: serviceAvailable(rangeText(9 * 60, 16 * 60), '周五雨天是例外，Clint 照常看店。'),
          tips: [],
          rules: [BASE_RULES.blacksmith],
        };
      }
      if (states.weather === 'greenRain') {
        return {
          shop: 'blacksmith',
          access,
          service: serviceUnknown('绿雨日程可能覆盖周五惯例，需当天复核。'),
          tips: [],
          rules: [BASE_RULES.blacksmith],
        };
      }
      return {
        shop: 'blacksmith',
        access,
        service: serviceUnavailable('社区中心修复后，晴天周五 Clint 不在店。'),
        tips: [],
        rules: [BASE_RULES.blacksmith],
      };
    }
    if (states.communityCenter === undefined) {
      return {
        shop: 'blacksmith',
        access,
        service: serviceUnknown('社区中心状态未填写，无法判断周五 Clint 是否在店。'),
        tips: [],
        rules: [BASE_RULES.blacksmith],
      };
    }
  }
  return {
    shop: 'blacksmith',
    access,
    service: serviceAvailable(rangeText(9 * 60, 16 * 60), '工具升级、取回与晶球处理共用 09:00–16:00 柜台。'),
    tips: [],
    rules: [BASE_RULES.blacksmith],
  };
}
