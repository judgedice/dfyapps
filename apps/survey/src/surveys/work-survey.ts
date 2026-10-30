// Work survey, served at dfy.work/work-survey/: How you work and the workflow survey in one.
//
// The activity grids from How you work replace the workflow survey's first section (execute,
// review, plan), and its request questions join the intake section. Questions are reused from
// both surveys, so edits there carry over here. Saves both surveys' derived values:
// `q4_placeCount` and `license`.
//
// Questions that feed the license are highlighted in DFY orange. Logging hours is a single
// "I log hours" checkbox above Next rather than a grid row. "I use Workfront Proof" is a checkbox
// under the decisions grid; it's saved as `usesProof`, and a checked box means at least Light.
import type {
  AllocationQuestion,
  MatrixQuestion,
  Question,
  Section,
  SingleQuestion,
  Survey,
} from '../survey';
import type { Answers } from '../answers';
import { survey as howYouWork } from './how-you-work';
import { survey as workflow } from './workflow-survey';

function sectionOf(s: Survey, id: string): Section {
  const section = s.sections.find((x) => x.id === id);
  if (!section) throw new Error(`Section "${id}" not found in ${s.id}`);
  return section;
}

const questionsOf = (s: Survey, id: string): Question[] => sectionOf(s, id).questions;

/** Same question, new wording, for pages that show more than one grid. */
const reworded = (q: Question, prompt: string): Question => ({ ...q, prompt });
const only = (s: Survey, id: string): Question => questionsOf(s, id)[0];

/** Marks a question as feeding the license, shown in DFY orange. */
const license = (q: Question): Question => ({ ...q, highlight: true });

const yourWork = only(howYouWork, 'your-work') as MatrixQuestion;

/** True when every row of a How you work grid is answered Every week or Every month. */
function allMonthlyOrMore(answers: Answers, questionId: string): boolean {
  const grid = only(howYouWork, questionId) as MatrixQuestion;
  const value = (answers[questionId] ?? {}) as Record<string, string>;
  return grid.rows.every((r) => value[r.id] === 'Every week' || value[r.id] === 'Every month');
}

// Time allocation, with this survey's own wording for the last two options. Item ids stay the same
// as the workflow survey's so the CSV columns line up.
const timeAllocation = only(workflow, 'time') as AllocationQuestion;
const ITEM_TEXT: Record<string, { label: string; description: string }> = {
  preparing: {
    label: 'Planning the work',
    description:
      'Clarifying scope, gathering inputs, organizing your approach, finding assignees, and meetings',
  },
  overhead: {
    label: 'Overhead',
    description: 'Things like status updates and timeline management',
  },
};

// "When information is missing, how long does it take to get it?" (q6) gets broader options here,
// with a fill-in for anything else.
const intakeQuestions = questionsOf(workflow, 'intake').map((q): Question =>
  q.id === 'q6'
    ? ({
        ...(q as SingleQuestion),
        options: ['Same day', 'Days', 'Other', 'It varies'],
        otherOption: 'Other',
        otherPrompt: 'How long does it usually take?',
      } satisfies SingleQuestion)
    : q,
);

export const survey: Survey = {
  id: 'work-survey',
  title: 'Work and workflow survey',
  intro:
    'About 6 minutes. Think about a typical week unless a question says otherwise.',
  derive: (answers) => ({ ...workflow.derive?.(answers), ...howYouWork.derive?.(answers) }),
  sections: [
    {
      id: 'your-work',
      title: 'Your own work',
      // Timekeeper for people who log hours, Busy bee for weekly on both activities, otherwise thanks.
      reward: (answers) => {
        if (answers.logsHours === true) return { icon: 'clock', label: 'Timekeeper' };
        const grid = (answers.yourWork ?? {}) as Record<string, string>;
        const rows = yourWork.rows.filter((r) => r.id !== 'logHours');
        if (rows.every((r) => grid[r.id] === 'Every week')) return { icon: 'bee', label: 'Busy bee' };
        return { icon: 'thumbsUp', label: 'Hey, thanks' };
      },
      questions: [
        license({ ...yourWork, rows: yourWork.rows.filter((r) => r.id !== 'logHours') }),
        // Volume ("How many tasks do you typically handle?") lives here rather than on its own page.
        ...questionsOf(workflow, 'volume'),
        license({ id: 'logsHours', type: 'checkbox', prompt: 'I log hours' }),
      ],
    },
    {
      id: 'planning-decisions',
      title: 'Planning and decisions',
      // First match wins: Proof users, then regular approvers (whatever their planning answers),
      // then regular planners, otherwise the usual reward.
      reward: (answers) => {
        if (answers.usesProof === true) return { icon: 'proof', label: 'Proof master' };
        if (allMonthlyOrMore(answers, 'decisions')) return { icon: 'approved', label: 'Approved' };
        if (allMonthlyOrMore(answers, 'planning')) return { icon: 'planner', label: 'Master planner' };
        return { icon: 'workflow', label: 'Nice work' };
      },
      questions: [
        license(reworded(only(howYouWork, 'planning'), 'How often do you plan work?')),
        license(reworded(only(howYouWork, 'decisions'), 'How often do you make these decisions?')),
        license({ id: 'usesProof', type: 'checkbox', prompt: 'I use Workfront Proof' }),
      ],
    },
    {
      ...sectionOf(workflow, 'time'),
      reward: { icon: 'strategy', label: 'Right on target' },
      questions: [
        {
          ...timeAllocation,
          items: timeAllocation.items.map((item) => ({ ...item, ...ITEM_TEXT[item.id] })),
        },
      ],
    },
    {
      ...sectionOf(workflow, 'intake'),
      // Anyone who gets work by carrier pigeon gets a pigeon.
      reward: (answers) =>
        Array.isArray(answers.q4) && answers.q4.some((place) => /carrier pigeon/i.test(place))
          ? { icon: 'pigeon', label: 'Message received' }
          : { icon: 'continuous', label: 'Past halfway' },
      questions: [
        ...intakeQuestions,
        license(reworded(only(howYouWork, 'requests'), 'How frequently do you work with requests?')),
      ],
    },
    {
      ...sectionOf(workflow, 'duration'),
      reward: { icon: 'layers', label: 'Going strong' },
    },
    {
      ...sectionOf(workflow, 'rework'),
      reward: { icon: 'visibility', label: 'Almost there' },
    },
    {
      ...sectionOf(workflow, 'assets'),
      reward: { icon: 'thumbsUp', label: 'One section left' },
    },
    {
      ...sectionOf(workflow, 'open'),
      questions: questionsOf(workflow, 'open').map((q) =>
        q.id === 'q17' ? reworded(q, 'What is the single biggest thing that slows down work for you?') : q,
      ),
    },
  ],
};
