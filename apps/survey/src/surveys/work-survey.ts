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
      reward: { icon: 'thumbsUp', label: 'Great job' },
      questions: [
        license({ ...yourWork, rows: yourWork.rows.filter((r) => r.id !== 'logHours') }),
        license({ id: 'logsHours', type: 'checkbox', prompt: 'I log hours' }),
      ],
    },
    {
      id: 'planning-decisions',
      title: 'Planning and decisions',
      reward: { icon: 'workflow', label: 'Nice work' },
      questions: [
        license(reworded(only(howYouWork, 'planning'), 'How often do you plan work like this?')),
        license(reworded(only(howYouWork, 'decisions'), 'How often do you make these decisions?')),
        license({ id: 'usesProof', type: 'checkbox', prompt: 'I use Workfront Proof' }),
      ],
    },
    {
      ...sectionOf(workflow, 'volume'),
      reward: { icon: 'analytics', label: 'Keep it going' },
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
        license(reworded(only(howYouWork, 'requests'), 'How often do you handle requests like these?')),
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
    sectionOf(workflow, 'open'),
  ],
};
