// How you work, served at dfy.work/how-you-work/.
//
// Respondents only describe what they do. Behind the scenes, `licenseFor` maps their answers to a
// work management license tier, saved as `derived.license` for the CSV. Tiers nest, each including
// everything in the one below it: External < Contributor < Light < Standard. The respondent never
// sees the tier, and the questions never name a tool.
import type { Answers, MatrixAnswer } from '../answers';
import type { Survey } from '../survey';

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
 * How often the respondent does an activity. The combined survey asks about logging hours with a
 * yes-or-no checkbox (`logsHours`) instead of a grid row; a checked box counts as weekly.
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
  return best;
}

export const survey: Survey = {
  id: 'how-you-work',
  title: 'How you work',
  intro: 'About 2 minutes. For each activity, choose how often you do it in a typical month.',
  derive: (answers) => ({ license: licenseFor(answers) }),
  sections: [
    {
      id: 'your-work',
      title: 'Your own work',
      reward: { icon: 'thumbsUp', label: 'Great job' },
      questions: [
        {
          id: 'yourWork',
          type: 'matrix',
          prompt: 'How often do you do these?',
          scale: SCALE,
          rows: [
            { id: 'markDone', label: 'Mark tasks assigned to you as done' },
            { id: 'logHours', label: 'Log the hours you worked' },
            { id: 'followWork', label: 'Check progress or comment on work others are doing' },
          ],
        },
      ],
    },
    {
      id: 'planning',
      title: 'Planning work',
      reward: { icon: 'workflow', label: 'Nice work' },
      questions: [
        {
          id: 'planning',
          type: 'matrix',
          prompt: 'How often do you do these?',
          scale: SCALE,
          rows: [
            { id: 'createTasks', label: 'Create tasks for yourself or others' },
            { id: 'createProjects', label: 'Set up new projects' },
          ],
        },
      ],
    },
    {
      id: 'requests',
      title: 'Requests',
      reward: { icon: 'continuous', label: 'One section left' },
      questions: [
        {
          id: 'requests',
          type: 'matrix',
          prompt: 'How often do you do these?',
          scale: SCALE,
          rows: [
            { id: 'sendRequests', label: 'Send a request asking someone else to do work' },
            { id: 'handleRequests', label: 'Respond to requests that others send you' },
          ],
        },
      ],
    },
    {
      id: 'decisions',
      title: 'Decisions',
      questions: [
        {
          id: 'decisions',
          type: 'matrix',
          prompt: 'How often do you do these?',
          scale: SCALE,
          rows: [
            { id: 'approveWork', label: 'Approve or reject tasks or projects' },
            { id: 'approveFiles', label: 'Approve or reject files, like designs or documents' },
            { id: 'approveTime', label: 'Approve the hours other people logged' },
          ],
        },
      ],
    },
  ],
};
