import type { Activity, ActivityIdentity } from '../src/core';
import { manualIdentity } from '../src/core';

let counter = 0;

export function makeActivity(partial: {
  id?: string;
  identity?: ActivityIdentity;
  name?: string;
  start: number;
  duration: number;
  editedByPlayer?: boolean;
  completed?: boolean;
}): Activity {
  counter += 1;
  return {
    identity: partial.identity ?? manualIdentity(partial.id ?? `a${counter}`),
    name: partial.name ?? `活动 ${counter}`,
    start: partial.start,
    duration: partial.duration,
    protection: {
      editedByPlayer: partial.editedByPlayer ?? false,
      completed: partial.completed ?? false,
    },
  };
}
