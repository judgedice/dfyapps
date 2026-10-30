// Work survey, served at dfy.work/work-survey/: How you work and the workflow survey in one.
//
// The activity grids from How you work replace the workflow survey's first section (execute,
// review, plan), and its request questions join the intake section. Questions are reused from
// both surveys, so edits there carry over here. Saves both surveys' derived values:
// `q4_placeCount` and `license`.
import type { Question, Section, Survey } from '../survey';
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
      questions: questionsOf(howYouWork, 'your-work'),
    },
    {
      id: 'planning-decisions',
      title: 'Planning and decisions',
      reward: { icon: 'workflow', label: 'Nice work' },
      questions: [
        reworded(only(howYouWork, 'planning'), 'How often do you plan work like this?'),
        reworded(only(howYouWork, 'decisions'), 'How often do you make these decisions?'),
      ],
    },
    {
      ...sectionOf(workflow, 'volume'),
      reward: { icon: 'analytics', label: 'Keep it going' },
    },
    {
      ...sectionOf(workflow, 'time'),
      reward: { icon: 'strategy', label: 'Right on target' },
    },
    {
      ...sectionOf(workflow, 'intake'),
      reward: { icon: 'continuous', label: 'Past halfway' },
      questions: [
        ...questionsOf(workflow, 'intake'),
        reworded(only(howYouWork, 'requests'), 'How often do you handle requests like these?'),
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
