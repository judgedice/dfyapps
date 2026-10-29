import type { Answers } from '../answers';

export { completeAnswers } from './answers.fixture';

export const STORAGE_PREFIX = 'task-workflow-survey:';

export function seedProgress(respondentId: string, answers: Answers, step: number) {
  window.localStorage.setItem(STORAGE_PREFIX + respondentId, JSON.stringify({ answers, step }));
}

export function setRespondent(id: string | null) {
  window.history.replaceState(null, '', id === null ? '/' : `/?r=${id}`);
}
