// Workfront license survey, served at dfy.work/workfront-license/.
//
// Workfront's four licenses nest: each one includes everything in the one below it.
//   External < Contributor < Light < Standard
// So the survey asks about the most capable license first and stops at the first "yes".
// Most people answer one or two questions; nobody answers more than three.
import type { Answers } from '../answers';
import type { Survey } from '../survey';

export type License = 'Standard' | 'Light' | 'Contributor' | 'External';

const YES = 'Yes, at least one of these';
const NO = 'No, none of these';

/** The license the answers point to, or '' while the survey is incomplete. */
export function licenseFor(answers: Answers): License | '' {
  if (answers.doesWork === YES) return 'Standard';
  if (answers.doesWork !== NO) return '';
  if (answers.tracksTime === YES) return 'Light';
  if (answers.tracksTime !== NO) return '';
  if (answers.followsWork === YES) return 'Contributor';
  if (answers.followsWork !== NO) return '';
  return 'External';
}

export const survey: Survey = {
  id: 'workfront-license',
  title: 'Which Workfront license do you need?',
  intro:
    'Up to three yes-or-no questions. Think about what you do in Workfront in a typical month.',
  showProgress: false,
  derive: (answers) => ({ license: licenseFor(answers) }),
  sections: [
    {
      id: 'work',
      title: 'Doing the work',
      questions: [
        {
          id: 'doesWork',
          type: 'single',
          prompt: 'Do you do any of these in Workfront?',
          examples: [
            'Get tasks assigned to you and mark them done',
            'Create projects, tasks, or templates',
            'Set up request queues, forms, or approval steps',
            'Build reports or dashboards for other people',
            'Plan people’s time, capacity, or portfolios',
            'Create proofs for others to review',
          ],
          options: [YES, NO],
        },
      ],
    },
    {
      id: 'time',
      title: 'Time and sign-off',
      showIf: (answers) => answers.doesWork === NO,
      questions: [
        {
          id: 'tracksTime',
          type: 'single',
          prompt: 'Do you do any of these in Workfront?',
          examples: [
            'Log your hours on a timesheet',
            'Approve other people’s timesheets',
            'Approve or reject proofs and documents often',
            'Look at a project’s full plan and timeline',
            'Look at portfolios and programs',
          ],
          options: [YES, NO],
        },
      ],
    },
    {
      id: 'follow',
      title: 'Keeping up with work',
      showIf: (answers) => answers.doesWork === NO && answers.tracksTime === NO,
      questions: [
        {
          id: 'followsWork',
          type: 'single',
          prompt: 'Do you do any of these in Workfront?',
          examples: [
            'Send in requests for new work',
            'Review and approve tasks, issues, or projects',
            'Follow progress and comment on work',
            'Use boards, reports, or dashboards',
            'Use the Workfront mobile app',
          ],
          hint: 'If you only open proofs, download documents, or check calendars, answer no.',
          options: [YES, NO],
        },
      ],
    },
  ],
};
