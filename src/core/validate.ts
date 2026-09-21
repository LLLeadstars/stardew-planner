import type { Activity, ActivityDetails, ActivityType, Checklist, Protection } from './activity';
import { isActivityIdentity, isActivityType } from './activity';
import { isGameDate } from './date';
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

const DETAIL_KEYS = new Set(['from', 'to', 'place', 'target']);

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isChecklist(value: unknown): value is Checklist {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isActivityDetails(value: unknown): value is ActivityDetails {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([key, entry]) => DETAIL_KEYS.has(key) && typeof entry === 'string',
  );
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

export function isPlannerState(value: unknown): value is PlannerState {
  if (!isRecord(value)) return false;
  return (
    isGameDate(value.currentDay) &&
    (value.mode === 'single' || value.mode === 'multi') &&
    Array.isArray(value.activities) &&
    value.activities.every(isActivity) &&
    isReservePreferences(value.reserves)
  );
}
