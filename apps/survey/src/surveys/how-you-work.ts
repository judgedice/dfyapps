// How you work, served at dfy.work/how-you-work/.
//
// Respondents only describe what they do. Behind the scenes, `licenseFor` maps their answers to a
// work management license tier, saved as `derived.license` for the CSV. Tiers nest, each including
// everything in the one below it: External < Contributor < Light < Standard. The respondent never
// sees the tier.
import type { Answers, MatrixAnswer } from '../answers';
import type { CheckboxQuestion, MatrixQuestion, SectionReward, Survey } from '../survey';

export type License = 'Standard' | 'Light' | 'Contributor' | 'External';

const OFTEN = ['Every week', 'Every month'];
const NEVER = 'Never';
const SCALE = [...OFTEN, 'Less often', NEVER];

/** Each activity, by section question and row, and the lowest tier that allows it. */
const NEEDS: { question: string; row: string; license: License; onlyIfOften?: boolean }[] = [
  { question: 'yourWork', row: 'markDone', license: 'Standard' },
  { question: 'planning', row: 'createTasks', license: 'Standard' },
  { question: 'planning', row: 'createProjects', license: 'Standard' },
  { question: 'requests', row: 'handleRequests', license: 'Standard' },
  { question: 'yourWork', row: 'logHours', license: 'Light' },
  { question: 'decisions', row: 'approveTime', license: 'Light' },
  // Lower tiers include a small number of file decisions, so only regular reviewers need Light.
  { question: 'decisions', row: 'approveFiles', license: 'Light', onlyIfOften: true },
  { question: 'decisions', row: 'approveFiles', license: 'Contributor' },
  { question: 'yourWork', row: 'followWork', license: 'Contributor' },
  { question: 'requests', row: 'sendRequests', license: 'Contributor' },
  { question: 'decisions', row: 'approveWork', license: 'Contributor' },
];

const RANK: License[] = ['External', 'Contributor', 'Light', 'Standard'];

/**
 * How often the respondent does an activity. Logging hours is asked with a yes-or-no checkbox
 * (`logsHours`) rather than a grid row; a checked box counts as weekly.
 */
function frequency(answers: Answers, question: string, row: string): string | undefined {
  const fromGrid = (answers[question] as MatrixAnswer | undefined)?.[row];
  if (fromGrid) return fromGrid;
  if (row === 'logHours' && typeof answers.logsHours === 'boolean') {
    return answers.logsHours ? OFTEN[0] : NEVER;
  }
  return undefined;
}

/** The tier the answers point to, or '' while any activity is unanswered. */
export function licenseFor(answers: Answers): License | '' {
  let best: License = 'External';
  for (const need of NEEDS) {
    const value = frequency(answers, need.question, need.row);
    if (!value) return '';
    const counts = need.onlyIfOften ? OFTEN.includes(value) : value !== NEVER;
    if (counts && RANK.indexOf(need.license) > RANK.indexOf(best)) best = need.license;
  }
  // "I use Workfront Proof" (`usesProof`) means at least Light.
  if (answers.usesProof === true && RANK.indexOf(best) < RANK.indexOf('Light')) best = 'Light';
  return best;
}

const isMonthlyOrMore = (value: string | undefined) => value !== undefined && OFTEN.includes(value);

/** True when every row of one of this survey's grids is answered Every week or Every month. */
function allMonthlyOrMore(answers: Answers, questionId: string): boolean {
  const grid = GRIDS[questionId];
  const value = (answers[questionId] ?? {}) as MatrixAnswer;
  return grid.rows.every((r) => isMonthlyOrMore(value[r.id]));
}

const GRIDS: Record<string, MatrixQuestion> = {
  yourWork: {
    id: 'yourWork',
    type: 'matrix',
    prompt: 'How often do you do these?',
    scale: SCALE,
    rows: [
      { id: 'markDone', label: 'Mark tasks assigned to you as done' },
      { id: 'followWork', label: 'Check progress or comment on work others are doing' },
    ],
  },
  planning: {
    id: 'planning',
    type: 'matrix',
    prompt: 'How often do you plan work?',
    scale: SCALE,
    rows: [
      { id: 'createTasks', label: 'Create tasks for yourself or others' },
      { id: 'createProjects', label: 'Set up new projects' },
    ],
  },
  decisions: {
    id: 'decisions',
    type: 'matrix',
    prompt: 'How often do you make these decisions?',
    scale: SCALE,
    rows: [
      { id: 'approveWork', label: 'Approve or reject tasks or projects' },
      { id: 'approveFiles', label: 'Approve or reject files, like designs or documents' },
      { id: 'approveTime', label: 'Approve the hours other people logged' },
    ],
  },
  requests: {
    id: 'requests',
    type: 'matrix',
    prompt: 'How frequently do you work with requests?',
    scale: SCALE,
    rows: [
      { id: 'sendRequests', label: 'Send a request asking someone else to do work' },
      { id: 'handleRequests', label: 'Respond to requests that others send you' },
    ],
  },
};

const logsHours: CheckboxQuestion = { id: 'logsHours', type: 'checkbox', prompt: 'I log hours' };
const usesProof: CheckboxQuestion = { id: 'usesProof', type: 'checkbox', prompt: 'I use Workfront Proof' };

/** Section 1 celebration: Timekeeper for people who log hours, Busy bee for weekly on both. */
export function yourWorkReward(answers: Answers): SectionReward {
  if (answers.logsHours === true) return { icon: 'clock', label: 'Timekeeper' };
  const value = (answers.yourWork ?? {}) as MatrixAnswer;
  if (GRIDS.yourWork.rows.every((r) => value[r.id] === OFTEN[0])) return { icon: 'bee', label: 'Busy bee' };
  return { icon: 'thumbsUp', label: 'Hey, thanks' };
}

/** Section 2 celebration. First match wins: Proof users, regular approvers, regular planners. */
export function planningDecisionsReward(answers: Answers): SectionReward {
  if (answers.usesProof === true) return { icon: 'proof', label: 'Proof master' };
  if (allMonthlyOrMore(answers, 'decisions')) return { icon: 'approved', label: 'Approved' };
  if (allMonthlyOrMore(answers, 'planning')) return { icon: 'planner', label: 'Master planner' };
  return { icon: 'workflow', label: 'Nice work' };
}

/**
 * The license-only survey. The combined Work and workflow survey reuses these sections and
 * questions, so the two stay in step.
 */
export const survey: Survey = {
  id: 'how-you-work',
  title: 'How you work',
  intro: 'About 2 minutes. For each activity, choose how often you do it in a typical month.',
  derive: (answers) => ({ license: licenseFor(answers) }),
  sections: [
    {
      id: 'your-work',
      title: 'Your own work',
      reward: yourWorkReward,
      questions: [GRIDS.yourWork, logsHours],
    },
    {
      id: 'planning-decisions',
      title: 'Planning and decisions',
      reward: planningDecisionsReward,
      questions: [GRIDS.planning, GRIDS.decisions, usesProof],
    },
    {
      id: 'requests',
      title: 'Requests',
      questions: [GRIDS.requests],
    },
  ],
};
