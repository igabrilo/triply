const FIRST_PLAN_GUIDE_EVENT = 'triply:first-plan-guide-changed';

function key(tripId: string, suffix: string): string {
  return `triply:first-plan-guide:${tripId}:${suffix}`;
}

function readFlag(storageKey: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(storageKey) === '1';
}

function writeFlag(storageKey: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  if (value) {
    window.localStorage.setItem(storageKey, '1');
  } else {
    window.localStorage.removeItem(storageKey);
  }
}

export function isGuideDismissed(tripId: string): boolean {
  return readFlag(key(tripId, 'dismissed'));
}

export function setGuideDismissed(tripId: string, value: boolean): void {
  writeFlag(key(tripId, 'dismissed'), value);
}

export function isGuideCompleted(tripId: string): boolean {
  return readFlag(key(tripId, 'completed'));
}

export function setGuideCompleted(tripId: string, value: boolean): void {
  writeFlag(key(tripId, 'completed'), value);
}

export function isGuideExportDone(tripId: string): boolean {
  return readFlag(key(tripId, 'exported'));
}

export function setGuideExportDone(tripId: string, value: boolean): void {
  writeFlag(key(tripId, 'exported'), value);
}

export function resetGuideState(tripId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key(tripId, 'dismissed'));
  window.localStorage.removeItem(key(tripId, 'completed'));
  window.localStorage.removeItem(key(tripId, 'exported'));
}

export function emitGuideChanged(tripId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FIRST_PLAN_GUIDE_EVENT, { detail: { tripId } }));
}

export function getGuideEventName(): string {
  return FIRST_PLAN_GUIDE_EVENT;
}
