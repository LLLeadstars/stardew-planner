import type { Activity, ActivityDetails, ActivityType, Checklist, Protection, ShoppingItem } from './activity';
import { isActivityIdentity, isActivityType } from './activity';
import { isShopKey } from './shop';
import { isGameDate } from './date';
import type { PendingToolUpgrade } from './toolUpgrade';
import {
  COMMUNITY_CENTER_OPTIONS,
  ROBIN_WORKING_OPTIONS,
  SPECIAL_DAY_OPTIONS,
  TOOL_LEVEL_OPTIONS,
  TOOL_OPTIONS,
  TOWN_KEY_OPTIONS,
  WEATHER_OPTIONS,
} from './playerState';
import type { PlayerStates, ToolLevels } from './playerState';
import type { PlannerState } from './planner';
import type { ReservePreferences } from './reserve';
import { DAY_START, LAST_START, MINUTE_STEP } from './time';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProtection(value: unknown): value is Protection {
  return (
    isRecord(value) && typeof value.editedByPlayer === 'boolean' && typeof value.completed === 'boolean'
  );
}

function isAligned(minutes: unknown): minutes is number {
  return Number.isInteger(minutes) && (minutes as number) % MINUTE_STEP === 0;
}

const DETAIL_STRING_KEYS = new Set(['from', 'to', 'place', 'target']);

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isChecklist(value: unknown): value is Checklist {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isShoppingItem(value: unknown): value is ShoppingItem {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    isOptionalString(value.quantity)
  );
}

function isShoppingList(value: unknown): value is ShoppingItem[] {
  return Array.isArray(value) && value.every(isShoppingItem);
}

function isActivityDetails(value: unknown): value is ActivityDetails {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([key, entry]) => {
    if (DETAIL_STRING_KEYS.has(key)) return typeof entry === 'string';
    if (key === 'shop') return isShopKey(entry);
    if (key === 'shoppingList') return isShoppingList(entry);
    if (key === 'tool') return isOptionValue(TOOL_OPTIONS, entry);
    return false;
  });
}

export function isActivity(value: unknown): value is Activity {
  if (!isRecord(value)) return false;
  return (
    isActivityIdentity(value.identity) &&
    isActivityType(value.activityType) &&
    typeof value.name === 'string' &&
    isAligned(value.start) &&
    (value.start as number) >= DAY_START &&
    (value.start as number) <= LAST_START &&
    isAligned(value.duration) &&
    (value.duration as number) >= MINUTE_STEP &&
    isProtection(value.protection) &&
    isOptionalString(value.note) &&
    (value.checklist === undefined || isChecklist(value.checklist)) &&
    (value.details === undefined || isActivityDetails(value.details))
  );
}

function isReserveMap(value: unknown): value is Partial<Record<ActivityType, number>> {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([activityType, minutes]) =>
      isActivityType(activityType) && isAligned(minutes) && (minutes as number) >= MINUTE_STEP,
  );
}

function isReservePreferences(value: unknown): value is ReservePreferences {
  return isRecord(value) && isReserveMap(value.personal) && isReserveMap(value.last);
}

function isOptionValue<T extends string>(
  options: readonly { value: T }[],
  value: unknown,
): value is T {
  return typeof value === 'string' && options.some((option) => option.value === value);
}

function isToolLevels(value: unknown): value is ToolLevels {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([tool, level]) => isOptionValue(TOOL_OPTIONS, tool) && isOptionValue(TOOL_LEVEL_OPTIONS, level),
  );
}

function isPlayerStates(value: unknown): value is PlayerStates {
  if (!isRecord(value)) return false;
  return (
    (value.weather === undefined || isOptionValue(WEATHER_OPTIONS, value.weather)) &&
    (value.specialDay === undefined || isOptionValue(SPECIAL_DAY_OPTIONS, value.specialDay)) &&
    (value.communityCenter === undefined ||
      isOptionValue(COMMUNITY_CENTER_OPTIONS, value.communityCenter)) &&
    (value.townKey === undefined || isOptionValue(TOWN_KEY_OPTIONS, value.townKey)) &&
    (value.robinWorking === undefined ||
      isOptionValue(ROBIN_WORKING_OPTIONS, value.robinWorking)) &&
    (value.toolLevels === undefined || isToolLevels(value.toolLevels))
  );
}

function isPendingToolUpgrade(value: unknown): value is PendingToolUpgrade | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return (
    isOptionValue(TOOL_OPTIONS, value.tool) &&
    isOptionValue(TOOL_LEVEL_OPTIONS, value.fromLevel) &&
    isOptionValue(TOOL_LEVEL_OPTIONS, value.targetLevel) &&
    isGameDate(value.deliveredOn) &&
    isGameDate(value.completesOn)
  );
}

export function isPlannerState(value: unknown): value is PlannerState {
  if (!isRecord(value)) return false;
  return (
    isGameDate(value.currentDay) &&
    (value.mode === 'single' || value.mode === 'multi') &&
    Array.isArray(value.activities) &&
    value.activities.every(isActivity) &&
    isReservePreferences(value.reserves) &&
    isPlayerStates(value.playerStates) &&
    isPendingToolUpgrade(value.toolUpgrade)
  );
}
