import type { Answers } from './answers';

export interface SavedProgress {
  answers: Answers;
  step: number;
}

const keyFor = (respondentId: string) => `task-workflow-survey:${respondentId || 'anonymous'}`;

export function loadProgress(respondentId: string): SavedProgress | null {
  try {
    const raw = window.localStorage.getItem(keyFor(respondentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.answers !== 'object') return null;
    return { answers: parsed.answers ?? {}, step: Number.isInteger(parsed.step) ? parsed.step! : 0 };
  } catch {
    return null;
  }
}

export function saveProgress(respondentId: string, progress: SavedProgress): void {
  try {
    window.localStorage.setItem(keyFor(respondentId), JSON.stringify(progress));
  } catch {
    // Storage unavailable (private mode, quota, blocked). The survey still works without it.
  }
}

export function clearProgress(respondentId: string): void {
  try {
    window.localStorage.removeItem(keyFor(respondentId));
  } catch {
    // Ignore; nothing to clear.
  }
}

export function readRespondentId(search: string = window.location.search): string {
  try {
    return new URLSearchParams(search).get('r')?.trim() ?? '';
  } catch {
    return '';
  }
}
