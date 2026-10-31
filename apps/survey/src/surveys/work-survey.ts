// Work survey, served at dfy.work/work-survey/: How you work and the workflow survey in one.
//
// The license questions from How you work (its first two pages, with their celebrations) replace
// the workflow survey's first section, and its requests grid joins the intake section. Questions
// are reused from both surveys, so edits there carry over here. Saves both surveys' derived
// values: `q4_placeCount` and `license`. The workflow survey itself is no longer published; it's
// the source for the rest of this survey's questions.
import type { AllocationQuestion, Question, Section, SingleQuestion, Survey } from '../survey';
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

/** The time allocation item with the largest share, or undefined if there's a tie for the top. */
function largestShare(answers: Answers): string | undefined {
  const shares = Object.entries((answers.q3 ?? {}) as Record<string, number>);
  const max = Math.max(...shares.map(([, v]) => v));
  const top = shares.filter(([, v]) => v === max);
  return top.length === 1 ? top[0][0] : undefined;
}

const DURATION_WORDING: Record<string, string> = {
  q7: 'On average, how long does a single task take for you in hands-on time?',
  q9: 'How many other people do your tasks typically depend on?',
};

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
      // How you work's first page, with the volume question ("How many tasks do you typically
      // handle?") added between the activity grid and the I log hours checkbox.
      ...sectionOf(howYouWork, 'your-work'),
      questions: (([grid, logsHours]) => [grid, ...questionsOf(workflow, 'volume'), logsHours])(
        questionsOf(howYouWork, 'your-work'),
      ),
    },
    sectionOf(howYouWork, 'planning-decisions'),
    {
      ...sectionOf(workflow, 'time'),
      // Named after where most of the week goes. A tie for the top spot gets the usual reward.
      reward: (answers) => {
        const top = largestShare(answers);
        if (top === 'finding') return { icon: 'sleuth', label: 'Work sleuth' };
        if (top === 'doing') return { icon: 'horse', label: 'Workhorse' };
        if (top === 'preparing') return { icon: 'planner', label: 'Master planner' };
        if (top === 'overhead') return { icon: 'sisyphus', label: 'Sisyphus' };
        return { icon: 'strategy', label: 'Right on target' };
      },
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
        only(howYouWork, 'requests'),
      ],
    },
    {
      ...sectionOf(workflow, 'duration'),
      reward: { icon: 'layers', label: 'Going strong' },
      // Worded to the respondent ("for you", "your tasks").
      questions: questionsOf(workflow, 'duration').map((q) =>
        q.id in DURATION_WORDING ? reworded(q, DURATION_WORDING[q.id]) : q,
      ),
    },
    {
      ...sectionOf(workflow, 'rework'),
      reward: { icon: 'visibility', label: 'Almost there' },
      questions: questionsOf(workflow, 'rework').map((q) =>
        q.id === 'q10'
          ? reworded(q, 'How many rounds of review and approval does a typical task/document go through?')
          : q,
      ),
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
