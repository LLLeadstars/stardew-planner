import type { Activity, Protection } from './activity';
import { isActivityIdentity } from './activity';
import { isGameDate } from './date';
import type { PlannerState } from './planner';
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

export function isActivity(value: unknown): value is Activity {
  if (!isRecord(value)) return false;
  return (
    isActivityIdentity(value.identity) &&
    typeof value.name === 'string' &&
    isAligned(value.start) &&
    (value.start as number) >= DAY_START &&
    (value.start as number) <= LAST_START &&
    isAligned(value.duration) &&
    (value.duration as number) >= MINUTE_STEP &&
    isProtection(value.protection)
  );
}

export function isPlannerState(value: unknown): value is PlannerState {
  if (!isRecord(value)) return false;
  return (
    isGameDate(value.currentDay) &&
    (value.mode === 'single' || value.mode === 'multi') &&
    Array.isArray(value.activities) &&
    value.activities.every(isActivity)
  );
}
