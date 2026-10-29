// Survey definition. Edit questions here; components render them generically.

interface BaseQuestion {
  /** Stable key used in the submitted `answers` object. */
  id: string;
  prompt: string;
  /** Optional helper text shown under the prompt. */
  hint?: string;
}

export interface SingleQuestion extends BaseQuestion {
  type: 'single';
  options: string[];
}

export interface MultiQuestion extends BaseQuestion {
  type: 'multi';
  options: string[];
  /** Option that reveals a free-text field. Its text is saved as `<id>_other`. */
  otherOption?: string;
}

export interface MatrixQuestion extends BaseQuestion {
  type: 'matrix';
  scale: string[];
  /** `id` is the key in the answer object; `label` is shown to respondents. */
  rows: { id: string; label: string }[];
}

export interface AllocationQuestion extends BaseQuestion {
  type: 'allocation';
  /** Inputs must sum to this value (percent). */
  total: number;
  items: { id: string; label: string; description?: string }[];
}

export interface TextQuestion extends BaseQuestion {
  type: 'text';
  maxLength: number;
}

export type Question =
  | SingleQuestion
  | MultiQuestion
  | MatrixQuestion
  | AllocationQuestion
  | TextQuestion;

/** Line icons available for section rewards. See src/components/Reward.tsx. */
export type RewardIcon =
  | 'thumbsUp'
  | 'analytics'
  | 'strategy'
  | 'workflow'
  | 'continuous'
  | 'layers'
  | 'visibility';

export interface Section {
  id: string;
  title: string;
  questions: Question[];
  /** Shown briefly the first time a respondent completes this section. */
  reward?: { icon: RewardIcon; label: string };
}

export interface Survey {
  title: string;
  intro: string;
  sections: Section[];
}

export const survey: Survey = {
  title: 'Task and workflow survey',
  intro: 'About 5 minutes. Think about a typical week unless a question says otherwise.',
  sections: [
    {
      id: 'nature',
      title: 'Nature of the work',
      reward: { icon: 'thumbsUp', label: 'Great job' },
      questions: [
        {
          id: 'q1',
          type: 'matrix',
          prompt: 'How often do you do each type of task?',
          scale: ['Most of my work', 'Regularly', 'Occasionally', 'Never'],
          rows: [
            { id: 'execute', label: 'Execute: create or build to instructions' },
            { id: 'review', label: 'Review: check for brand, legal, or other compliance' },
            { id: 'plan', label: 'Plan: define scope, schedule, and assign work' },
          ],
        },
      ],
    },
    {
      id: 'volume',
      title: 'Volume',
      reward: { icon: 'analytics', label: 'Nice work' },
      questions: [
        {
          id: 'q2',
          type: 'matrix',
          prompt: 'How many tasks do you typically handle?',
          scale: ['1–5', '6–10', '11–20', '21+'],
          rows: [
            { id: 'busiestDay', label: 'Tasks to accomplish on your busiest day' },
            { id: 'openAtOnce', label: 'Tasks open at the same time' },
          ],
        },
      ],
    },
    {
      id: 'time',
      title: 'Time allocation',
      reward: { icon: 'strategy', label: 'Right on target' },
      questions: [
        {
          id: 'q3',
          type: 'allocation',
          prompt:
            'In a typical week, roughly what percentage of your time goes to each? (Total 100%)',
          total: 100,
          items: [
            {
              id: 'finding',
              label: 'Finding the work',
              description:
                'Checking email, chat, trackers, and other places to find out what you need to do',
            },
            {
              id: 'doing',
              label: 'Doing the work',
              description: 'The execution, review, or planning itself',
            },
            {
              id: 'preparing',
              label: 'Preparing',
              description:
                'Clarifying scope, gathering inputs, organizing your own approach before starting',
            },
            {
              id: 'overhead',
              label: 'Overhead',
              description:
                'Status updates, chasing approvals, searching for files, switching between tools, meetings about work rather than doing it',
            },
          ],
        },
      ],
    },
    {
      id: 'intake',
      title: 'Notification and intake',
      reward: { icon: 'workflow', label: 'Halfway there' },
      questions: [
        {
          id: 'q4',
          type: 'multi',
          prompt: 'Where do you find out you have something to do?',
          hint: 'Select every place you check.',
          options: [
            'Email',
            'Chat',
            'Project tool notification',
            'Meeting',
            'Verbal, drive-by, or carrier pigeon',
            'Spreadsheet or tracker',
            'Other',
          ],
          otherOption: 'Other',
        },
        {
          id: 'q5',
          type: 'single',
          prompt: 'When a task arrives, how often does it include everything you need to start?',
          options: ['Always', 'Usually', 'Sometimes', 'Rarely'],
        },
        {
          id: 'q6',
          type: 'single',
          prompt: 'When information is missing, how long does it take to get it?',
          options: ['Under 1 hour', 'Same day', '1–2 days', '3+ days'],
        },
      ],
    },
    {
      id: 'duration',
      title: 'Duration and dependencies',
      reward: { icon: 'continuous', label: 'Keep it going' },
      questions: [
        {
          id: 'q7',
          type: 'single',
          prompt: 'On average, how long does a single task take in hands-on time?',
          options: ['Under 30 min', '30 min–2 hrs', '2–4 hrs', '4+ hrs'],
        },
        {
          id: 'q8',
          type: 'single',
          prompt:
            'How much calendar time passes between receiving a task and completing it?',
          options: ['Same day', '1–2 days', '3–5 days', '1+ week'],
        },
        {
          id: 'q9',
          type: 'single',
          prompt: 'How many other people does a typical task depend on?',
          options: ['Usually just me', 'A few others (1–3)', 'Several others (4+)'],
        },
      ],
    },
    {
      id: 'rework',
      title: 'Rework',
      reward: { icon: 'layers', label: 'Almost there' },
      questions: [
        {
          id: 'q10',
          type: 'single',
          prompt: 'How many rounds of review and approval does a typical task go through?',
          options: ['0', '1', '2', '3+'],
        },
        {
          id: 'q11',
          type: 'single',
          prompt: 'How many times do requirements change after work starts?',
          options: ['0', '1', '2', '3+'],
        },
        {
          id: 'q12',
          type: 'single',
          prompt: 'How often is feedback from different reviewers conflicting?',
          options: ['Never', 'Sometimes', 'Often', 'Almost always'],
        },
      ],
    },
    {
      id: 'assets',
      title: 'Assets within tasks',
      reward: { icon: 'visibility', label: 'One section left' },
      questions: [
        {
          id: 'q13',
          type: 'single',
          prompt:
            'How often do your tasks require finding an existing asset rather than creating a new one?',
          options: ['Most of the time', 'Some of the time', 'Rarely'],
        },
        {
          id: 'q14',
          type: 'single',
          prompt: 'How long does it usually take to find the right, current version?',
          options: ['Under 2 min', '2–10 min', '10–30 min', '30+ min'],
        },
        {
          id: 'q15',
          type: 'single',
          prompt: 'How often do you recreate something because you couldn’t find it?',
          options: ['Most of the time', 'Some of the time', 'Rarely'],
        },
      ],
    },
    {
      id: 'open',
      title: 'Open-ended',
      questions: [
        {
          id: 'q16',
          type: 'text',
          prompt: 'Which task do you repeat most often that feels like it could be automated?',
          maxLength: 1000,
        },
        {
          id: 'q17',
          type: 'text',
          prompt: 'What’s the single biggest thing that slows a task down for you?',
          maxLength: 1000,
        },
      ],
    },
  ],
};
