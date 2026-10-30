// Survey types. Each survey's questions live in src/surveys/; components render them generically.
import type { Answers } from './answers';

interface BaseQuestion {
  /** Stable key used in the submitted `answers` object. */
  id: string;
  prompt: string;
  /** Optional helper text shown under the prompt. */
  hint?: string;
  /** Optional bulleted examples shown under the prompt, to make a question concrete. */
  examples?: string[];
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
  /** Show this section only when it returns true for the answers so far. Hidden answers aren't submitted. */
  showIf?: (answers: Answers) => boolean;
}

export interface Survey {
  /** URL path and storage folder, e.g. `workflow-survey` serves at dfy.work/workflow-survey/. */
  id: string;
  title: string;
  intro: string;
  sections: Section[];
  /** localStorage key prefix for in-progress answers. Defaults to `id`. */
  storageKey?: string;
  /** Show the "Section 1 of 8" bar. Defaults to true. */
  showProgress?: boolean;
  /**
   * Values computed from the answers at submit time, saved under `derived`. Called with `{}` to
   * learn the column names for the CSV export, so it must not throw on missing answers.
   */
  derive?: (answers: Answers) => Record<string, string | number>;
}
